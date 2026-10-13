package com.neueda.leap.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Read-only connection to the reporting database (leap_analytics), which the ETL
 * fills from the trading database. Reporting queries run here, never against the
 * live trading database.
 *
 * Not exposed as a DataSource bean, so Spring Boot keeps auto-configuring the
 * primary (trading) DataSource that MyBatis uses.
 */
@Component
public class AnalyticsDatabase implements DisposableBean {

    private final HikariDataSource dataSource;
    private final NamedParameterJdbcTemplate jdbc;

    public AnalyticsDatabase(
            @Value("${analytics.datasource.url}") String url,
            @Value("${analytics.datasource.username}") String username,
            @Value("${analytics.datasource.password}") String password) {
        HikariConfig config = new HikariConfig();
        config.setPoolName("analytics");
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        // Postgres rejects INSERT/UPDATE/DELETE on a read-only connection. The driver only enforces
        // read-only inside explicit transactions unless readOnlyMode is "always".
        config.setReadOnly(true);
        config.addDataSourceProperty("readOnlyMode", "always");
        config.setMaximumPoolSize(3);
        config.setConnectionTimeout(5000);
        // Start without a connection, so the API still boots when the analytics database is down.
        config.setInitializationFailTimeout(-1);
        this.dataSource = new HikariDataSource(config);
        this.jdbc = new NamedParameterJdbcTemplate(dataSource);
    }

    public NamedParameterJdbcTemplate jdbc() {
        return jdbc;
    }

    @Override
    public void destroy() {
        dataSource.close();
    }
}
