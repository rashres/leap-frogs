package com.neueda.leap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Session login, role isolation, and freeze enforcement.
 * Requires rbac-schema.sql + rbac-seed.sql applied to the operational DB.
 * Set LEAP_DEMO_PASSWORD in local .env (must match hashes in rbac-seed.sql).
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("RBAC authentication and authorization")
class RbacAuthIntegrationTest {

    private static String demoPassword;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @BeforeAll
    static void requireDemoPassword() {
        demoPassword = System.getenv("LEAP_DEMO_PASSWORD");
        if (demoPassword == null || demoPassword.isBlank()) {
            // Spring also loads repo-root .env as properties for the process when tests run via Maven
            // with env inherited; fall back to system property for IDE runs.
            demoPassword = System.getProperty("LEAP_DEMO_PASSWORD", "");
        }
        assertFalse(demoPassword.isBlank(),
                "Set LEAP_DEMO_PASSWORD in .env (see .env.example) to run RBAC tests");
    }

    @Test
    @DisplayName("joanna logs in and reaches trader home; cannot list all accounts")
    void joannaLoginAndIsolation() throws Exception {
        MockHttpSession session = login("joanna", demoPassword, false);
        mvc.perform(get("/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TRADER"))
                .andExpect(jsonPath("$.homePath").value("/portfolio"));

        mvc.perform(get("/accounts").session(session))
                .andExpect(status().isForbidden());

        JsonNode me = mapper.readTree(mvc.perform(get("/auth/me").session(session))
                .andReturn().getResponse().getContentAsString());
        int ownId = me.get("accountId").asInt();
        mvc.perform(get("/accounts/" + ownId).session(session))
                .andExpect(status().isOk());

        mvc.perform(get("/accounts/1").session(session))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("priya reaches analytics home and cannot place orders")
    void priyaAnalyticsOnly() throws Exception {
        MockHttpSession session = login("priya", demoPassword, false);
        mvc.perform(get("/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("BUSINESS_ANALYST"))
                .andExpect(jsonPath("$.homePath").value("/analytics"));

        mvc.perform(post("/accounts/1/orders")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"instrumentId\":1,\"side\":\"BUY\",\"quantity\":1}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("david can freeze and unfreeze; cannot trade")
    void davidFreezeAndNoTrade() throws Exception {
        MockHttpSession session = login("david", demoPassword, false);
        mvc.perform(get("/auth/me").session(session))
                .andExpect(jsonPath("$.role").value("TRADING_OPERATIONS"))
                .andExpect(jsonPath("$.homePath").value("/ops"));

        mvc.perform(post("/ops/accounts/2/freeze")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"RBAC test freeze\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FROZEN"));

        mvc.perform(post("/accounts/2/orders")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"instrumentId\":1,\"side\":\"BUY\",\"quantity\":0.001}"))
                .andExpect(status().isForbidden());

        // Super Admin can attempt a trade on a frozen account — OrderService rejects it.
        MockHttpSession admin = login("admin", demoPassword, true);
        mvc.perform(post("/accounts/2/orders")
                        .session(admin)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"instrumentId\":1,\"side\":\"BUY\",\"quantity\":0.001}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/ops/accounts/2/unfreeze")
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("admin uses admin login; ordinary login rejects super admin")
    void adminDedicatedLogin() throws Exception {
        mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"" + demoPassword + "\"}"))
                .andExpect(status().isForbidden());

        MockHttpSession session = login("admin", demoPassword, true);
        mvc.perform(get("/auth/me").session(session))
                .andExpect(jsonPath("$.role").value("SUPER_ADMIN"))
                .andExpect(jsonPath("$.homePath").value("/portfolio"));
        mvc.perform(get("/accounts").session(session))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("exactly one SUPER_ADMIN exists in seed")
    void oneSuperAdmin() throws Exception {
        MockHttpSession session = login("admin", demoPassword, true);
        String body = mvc.perform(get("/auth/me").session(session))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(body.contains("SUPER_ADMIN"));
        assertEquals("SUPER_ADMIN", mapper.readTree(body).get("role").asText());
    }

    private MockHttpSession login(String username, String password, boolean admin) throws Exception {
        String path = admin ? "/auth/admin/login" : "/auth/login";
        MvcResult result = mvc.perform(post(path)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
