package com.neueda.leap.services;

import com.neueda.leap.kafka.OrderCompletedEvent;
import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.Order;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("OrderService Kafka Event Tests")
class OrderServiceKafkaEventTest {

    private AccountService accountService;
    private HoldingsMapper holdingsMapper;
    private OrderMapper orderMapper;
    private ApplicationEventPublisher eventPublisher;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        accountService = mock(AccountService.class);
        InstrumentService instrumentService = mock(InstrumentService.class);
        holdingsMapper = mock(HoldingsMapper.class);
        orderMapper = mock(OrderMapper.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        orderService = new OrderService(accountService, instrumentService, holdingsMapper, orderMapper, eventPublisher);

        Instrument apple = new Instrument(3, "AAPL", "Apple Inc.", 1);
        apple.setLastPrice(new BigDecimal("10"));
        when(instrumentService.findById(3)).thenReturn(apple);
        // Pretend MyBatis wrote the new transaction_id back into the order
        doAnswer(invocation -> {
            invocation.<Order>getArgument(0).setOrderId(555);
            return null;
        }).when(orderMapper).insertOrder(any(Order.class));
    }

    private void givenAccountWithCash(String cash) {
        when(accountService.findById(7)).thenReturn(new Account(7, "Test User", "test@example.com", new BigDecimal(cash)));
    }

    @Test
    @DisplayName("Should publish OrderCompletedEvent for a completed BUY")
    void testCompletedOrderPublishesEvent() {
        givenAccountWithCash("1000");

        orderService.placeOrder(7, 3, "buy", new BigDecimal("5"));

        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(captor.capture());
        OrderCompletedEvent event = assertInstanceOf(OrderCompletedEvent.class, captor.getValue());
        assertEquals(555, event.getOrder().getOrderId());
        assertEquals("COMPLETE", event.getOrder().getStatus());
        assertEquals("BUY", event.getOrder().getSide());
    }

    @Test
    @DisplayName("Should publish only after the order, cash and holdings are saved")
    void testPublishedAfterSaving() {
        givenAccountWithCash("1000");

        orderService.placeOrder(7, 3, "BUY", new BigDecimal("5"));

        InOrder inOrder = inOrder(orderMapper, holdingsMapper, eventPublisher);
        inOrder.verify(orderMapper).insertOrder(any(Order.class));
        inOrder.verify(holdingsMapper).upsertHolding(any());
        inOrder.verify(eventPublisher).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("Should not publish a rejected order (not enough cash)")
    void testRejectedOrderPublishesNothing() {
        givenAccountWithCash("1");

        OrderResult result = orderService.placeOrder(7, 3, "BUY", new BigDecimal("500"));

        assertTrue(result.isRejected());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    @DisplayName("Should not publish a rejected SELL (no shares held)")
    void testRejectedSellPublishesNothing() {
        givenAccountWithCash("1000");
        when(holdingsMapper.findByAccountIdAndInstrumentId(7, 3)).thenReturn(null);

        OrderResult result = orderService.placeOrder(7, 3, "SELL", new BigDecimal("2"));

        assertTrue(result.isRejected());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    @DisplayName("Should not publish an invalid order (bad side)")
    void testInvalidOrderPublishesNothing() {
        givenAccountWithCash("1000");

        assertThrows(InvalidOrderException.class,
                () -> orderService.placeOrder(7, 3, "HOLD", new BigDecimal("5")));

        verifyNoInteractions(eventPublisher);
    }
}
