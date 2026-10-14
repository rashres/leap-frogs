package com.neueda.leap;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /analytics/order-outcomes against the real leap_analytics.fact_orders. Like
 * AnalyticsIntegrationTest, the fixture orders are placed in January 2001 under
 * made-up symbols so they never mix with the ETL's data, and are removed afterwards.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsOrderOutcomesIntegrationTest {

    private static final String JANUARY_2001 = "from=2001-01-01&to=2001-01-31";

    @Autowired
    private MockMvc mvc;

    @Value("${analytics.datasource.url}")
    private String url;
    @Value("${analytics.datasource.username}")
    private String username;
    @Value("${analytics.datasource.password}")
    private String password;

    private JdbcTemplate fixture;

    @BeforeEach
    void insertFixtureOrders() {
        fixture = new JdbcTemplate(new DriverManagerDataSource(url, username, password));
        deleteFixtureOrders();
        String insert = """
                INSERT INTO fact_orders (transaction_id, account_id, symbol, stock_name, exchange_name, transaction_type,
                                         order_type, time_in_force, status, quantity, limit_price, price, amount,
                                         placed_at, closed_at, placed_date)
                VALUES (?, 9001, ?, ?, 'TESTX', 'BUY', ?, ?, ?, 1, ?, 100, 100, ?::timestamptz, ?::timestamptz, ?::date)
                """;
        // TEST.A: one filled, two cancelled, one expired. TEST.B: one pending, one rejected.
        fixture.update(insert, 990101, "TEST.A", "Test A", "MARKET", "DAY", "COMPLETE", null, "2001-01-02T15:00Z", null, "2001-01-02");
        fixture.update(insert, 990102, "TEST.A", "Test A", "LIMIT", "GTC", "CANCELLED", 90, "2001-01-03T15:00Z", "2001-01-05T15:00Z", "2001-01-03");
        fixture.update(insert, 990103, "TEST.A", "Test A", "LIMIT", "DAY", "CANCELLED", 95, "2001-01-04T15:00Z", "2001-01-04T16:00Z", "2001-01-04");
        fixture.update(insert, 990104, "TEST.A", "Test A", "LIMIT", "DAY", "EXPIRED", 80, "2001-01-04T15:00Z", "2001-01-04T21:00Z", "2001-01-04");
        fixture.update(insert, 990105, "TEST.B", "Test B", "MARKET", "DAY", "PENDING", null, "2001-01-06T15:00Z", null, "2001-01-06");
        fixture.update(insert, 990106, "TEST.B", "Test B", "MARKET", "DAY", "FAILED", null, "2001-01-06T15:00Z", null, "2001-01-06");
    }

    @AfterEach
    void deleteFixtureOrders() {
        fixture.update("DELETE FROM fact_orders WHERE transaction_id BETWEEN 990101 AND 990106");
    }

    @Test
    void totalsCountEveryOutcome() throws Exception {
        mvc.perform(get("/analytics/order-outcomes?" + JANUARY_2001))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.orders").value(6))
                .andExpect(jsonPath("$.totals.filled").value(1))
                .andExpect(jsonPath("$.totals.pending").value(1))
                .andExpect(jsonPath("$.totals.cancelled").value(2))
                .andExpect(jsonPath("$.totals.expired").value(1))
                .andExpect(jsonPath("$.totals.rejected").value(1))
                .andExpect(jsonPath("$.totals.cancelRate").value(33.33))
                .andExpect(jsonPath("$.totals.fillRate").value(16.67));
    }

    @Test
    void perInstrumentBusiestFirst() throws Exception {
        mvc.perform(get("/analytics/order-outcomes?" + JANUARY_2001))
                .andExpect(jsonPath("$.instruments[0].symbol").value("TEST.A"))
                .andExpect(jsonPath("$.instruments[0].counts.orders").value(4))
                .andExpect(jsonPath("$.instruments[0].counts.cancelRate").value(50.0))
                .andExpect(jsonPath("$.instruments[1].symbol").value("TEST.B"))
                .andExpect(jsonPath("$.instruments[1].counts.cancelled").value(0));
    }

    @Test
    void recentlyClosedNewestFirstWithoutAccounts() throws Exception {
        mvc.perform(get("/analytics/order-outcomes?" + JANUARY_2001 + "&recent=2"))
                .andExpect(jsonPath("$.recentlyClosed.length()").value(2))
                .andExpect(jsonPath("$.recentlyClosed[0].orderId").value(990102))
                .andExpect(jsonPath("$.recentlyClosed[0].status").value("CANCELLED"))
                .andExpect(jsonPath("$.recentlyClosed[1].orderId").value(990104))
                .andExpect(jsonPath("$.recentlyClosed[1].status").value("EXPIRED"))
                .andExpect(jsonPath("$.recentlyClosed[0].accountId").doesNotExist());
    }

    @Test
    void symbolAndDatesNarrowIt() throws Exception {
        mvc.perform(get("/analytics/order-outcomes?from=2001-01-06&to=2001-01-31&symbol=test.b"))
                .andExpect(jsonPath("$.totals.orders").value(2))
                .andExpect(jsonPath("$.recentlyClosed.length()").value(0));
    }

    @Test
    void emptyPeriodHasNoRates() throws Exception {
        mvc.perform(get("/analytics/order-outcomes?from=1999-01-01&to=1999-01-31"))
                .andExpect(jsonPath("$.totals.orders").value(0))
                .andExpect(jsonPath("$.totals.cancelRate").value(nullValue()));
    }

    @Test
    void recentOutOfRangeIsRejected() throws Exception {
        mvc.perform(get("/analytics/order-outcomes?recent=101")).andExpect(status().isBadRequest());
    }
}
