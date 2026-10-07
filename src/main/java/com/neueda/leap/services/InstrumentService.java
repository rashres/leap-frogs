package com.neueda.leap.services;

import com.neueda.leap.mappers.InstrumentMapper;
import com.neueda.leap.mappers.PriceHistoryMapper;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.PricePoint;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class InstrumentService {

    private final InstrumentMapper instrumentMapper;
    private final PriceHistoryMapper priceHistoryMapper;

    public InstrumentService(InstrumentMapper instrumentMapper, PriceHistoryMapper priceHistoryMapper) {
        this.instrumentMapper = instrumentMapper;
        this.priceHistoryMapper = priceHistoryMapper;
    }

    public List<Instrument> findAll() {
        return instrumentMapper.findAll();
    }

    public Instrument findById(int instrumentId) {
        Instrument instrument = instrumentMapper.findByInstrumentId(instrumentId);
        if (instrument == null) {
            throw new ResourceNotFoundException("Instrument", instrumentId);
        }
        return instrument;
    }

    /**
     * Recorded prices for one instrument over a range, oldest first.
     *
     * The range ends at the latest recorded price rather than now, so a chart
     * still has data when the price fetcher has not run for a while.
     */
    public List<PricePoint> priceHistory(int instrumentId, PriceRange range) {
        findById(instrumentId);
        Instant latest = priceHistoryMapper.findLatestObservedAt(instrumentId);
        if (latest == null) {
            return List.of();
        }
        return priceHistoryMapper.findSince(instrumentId, latest.minus(range.span()), range.bucket());
    }
}
