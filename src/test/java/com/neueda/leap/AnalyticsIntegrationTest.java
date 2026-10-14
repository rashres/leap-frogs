package com.neueda.leap;

import com.neueda.leap.config.AnalyticsDatabase;
import com.neueda.leap.services.AnalyticsService;
import com.neueda.leap.services.domain.Analytics.Filter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runs against the real leap_analytics database. The fixture trades are dated January 2001
 * under made-up symbols, so they never mix with the ETL's data, and are removed afterwards.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsIntegrationTest {

    private static final String JANUARY_2001 = "from=2001-01-01&to=2001-01-31";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private AnalyticsDatabase analyticsDatabase;

    @Value("${analytics.datasource.url}")
    private String url;
    @Value("${analytics.datasource.username}")
    private String username;
    @Value("${analytics.datasource.password}")
    private String password;

    /** Writable connection for the fixture only; the API's own connection is read-only. */
    private JdbcTemplate fixture;

    @BeforeEach
    void insertFixtureTrades() {
        fixture = new JdbcTemplate(new DriverManagerDataSource(url, username, password));
        deleteFixtureTrades();
        String insert = """
                INSERT INTO fact_trades (transaction_id, account_id, symbol, segment, stock_name, exchange_name,
                                         transaction_type, quantity, price, amount, trade_date, transactions_time)
                VALUES (?, ?, ?, 'Standard', ?, 'TESTX', ?, ?, ?, ?, ?::date, ?::date)
                """;
        fixture.update(insert, 990001, 9001, "TEST.A", "Test A", "BUY", 10, 100, 1000, "2001-01-02", "2001-01-02");
        fixture.update(insert, 990002, 9001, "TEST.A", "Test A", "SELL", 5, 100, 500, "2001-01-03", "2001-01-03");
        fixture.update(insert, 990003, 9002, "TEST.A", "Test A", "BUY", 2, 100, 200, "2001-01-03", "2001-01-03");
        fixture.update(insert, 990004, 9002, "TEST.B", "Test B", "BUY", 1, 250, 250, "2001-01-20", "2001-01-20");
    }

    @AfterEach
    void deleteFixtureTrades() {
        fixture.update("DELETE FROM fact_trades WHERE transaction_id BETWEEN 990001 AND 990004");
    }

    @Test
    void summaryTotalsTheDateRange() throws Exception {
        mvc.perform(get("/analytics/summary?" + JANUARY_2001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trades").value(4))
                .andExpect(jsonPath("$.buyTrades").value(3))
                .andExpect(jsonPath("$.sellTrades").value(1))
                .andExpect(jsonPath("$.valueTraded").value(1950.0))
                .andExpect(jsonPath("$.buyValue").value(1450.0))
                .andExpect(jsonPath("$.sellValue").value(500.0))
                .andExpect(jsonPath("$.activeClients").value(2))
                .andExpect(jsonPath("$.instrumentsTraded").value(2))
                .andExpect(jsonPath("$.dataAsOf", notNullValue()));
    }

    @Test
    void symbolFilterIsCaseInsensitive() throws Exception {
        mvc.perform(get("/analytics/summary?" + JANUARY_2001 + "&symbol=test.b"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trades").value(1))
                .andExpect(jsonPath("$.valueTraded").value(250.0))
                .andExpect(jsonPath("$.activeClients").value(1));
    }

    @Test
    void volumeGroupsByDayOrMonth() throws Exception {
        mvc.perform(get("/analytics/volume?" + JANUARY_2001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].period").value("2001-01-02"))
                .andExpect(jsonPath("$[1].period").value("2001-01-03"))
                .andExpect(jsonPath("$[1].trades").value(2))
                .andExpect(jsonPath("$[1].buyValue").value(200.0))
                .andExpect(jsonPath("$[1].sellValue").value(500.0))
                .andExpect(jsonPath("$[1].valueTraded").value(700.0));

        mvc.perform(get("/analytics/volume?" + JANUARY_2001 + "&interval=MONTH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].period").value("2001-01-01"))
                .andExpect(jsonPath("$[0].trades").value(4))
                .andExpect(jsonPath("$[0].valueTraded").value(1950.0));
    }

    @Test
    void instrumentsAreRankedByValueTraded() throws Exception {
        mvc.perform(get("/analytics/instruments?" + JANUARY_2001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].symbol").value("TEST.A"))
                .andExpect(jsonPath("$[0].name").value("Test A"))
                .andExpect(jsonPath("$[0].exchange").value("TESTX"))
                .andExpect(jsonPath("$[0].trades").value(3))
                .andExpect(jsonPath("$[0].buyTrades").value(2))
                .andExpect(jsonPath("$[0].sellTrades").value(1))
                .andExpect(jsonPath("$[0].clients").value(2))
                .andExpect(jsonPath("$[0].valueTraded").value(1700.0))
                .andExpect(jsonPath("$[1].symbol").value("TEST.B"));

        mvc.perform(get("/analytics/instruments?" + JANUARY_2001 + "&limit=1"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void marketsGroupByExchange() throws Exception {
        mvc.perform(get("/analytics/markets?" + JANUARY_2001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].exchange").value("TESTX"))
                .andExpect(jsonPath("$[0].trades").value(4))
                .andExpect(jsonPath("$[0].instruments").value(2))
                .andExpect(jsonPath("$[0].valueTraded").value(1950.0));
    }

    @Test
    void clientsAreCountedPerMonth() throws Exception {
        mvc.perform(get("/analytics/clients?" + JANUARY_2001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].month").value("2001-01-01"))
                .andExpect(jsonPath("$[0].activeClients").value(2))
                .andExpect(jsonPath("$[0].trades").value(4))
                .andExpect(jsonPath("$[0].avgTradesPerClient").value(2.0));
    }

    @Test
    void emptyRangeReturnsZeros() throws Exception {
        mvc.perform(get("/analytics/summary?from=1990-01-01&to=1990-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trades").value(0))
                .andExpect(jsonPath("$.valueTraded").value(0));
        mvc.perform(get("/analytics/volume?from=1990-01-01&to=1990-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void invalidParametersAreRejected() throws Exception {
        mvc.perform(get("/analytics/summary?from=2001-02-01&to=2001-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be on or before to"));
        mvc.perform(get("/analytics/summary?from=yesterday")).andExpect(status().isBadRequest());
        mvc.perform(get("/analytics/summary?symbol=AAPL;DROP")).andExpect(status().isBadRequest());
        mvc.perform(get("/analytics/volume?interval=hour")).andExpect(status().isBadRequest());
        mvc.perform(get("/analytics/instruments?limit=0")).andExpect(status().isBadRequest());
        mvc.perform(get("/analytics/instruments?limit=101")).andExpect(status().isBadRequest());
    }

    @Test
    void apiConnectionCannotWrite() {
        assertThatThrownBy(() -> analyticsDatabase.jdbc().getJdbcTemplate()
                .update("DELETE FROM fact_trades WHERE transaction_id = 990001"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("read-only");
        assertThat(fixture.queryForObject(
                "SELECT COUNT(*) FROM fact_trades WHERE transaction_id = 990001", Integer.class)).isEqualTo(1);
    }

    @Test
    void unreachableDatabaseGives503() {
        AnalyticsDatabase down = new AnalyticsDatabase("jdbc:postgresql://localhost:1/leap_analytics", username, password);
        try {
            assertThatThrownBy(() -> new AnalyticsService(down).summary(new Filter(null, null, null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .hasMessageContaining("503");
        } finally {
            down.destroy();
        }
    }
}
