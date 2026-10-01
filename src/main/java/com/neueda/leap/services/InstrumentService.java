package com.neueda.leap.services;

import com.neueda.leap.mappers.InstrumentMapper;
import com.neueda.leap.services.domain.Instrument;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InstrumentService {

    private final InstrumentMapper instrumentMapper;

    public InstrumentService(InstrumentMapper instrumentMapper) {
        this.instrumentMapper = instrumentMapper;
    }

    public List<Instrument> findAll() {
        return instrumentMapper.findAll();
    }

    public Instrument findById(int instrumentId) {
        Instrument instrument = instrumentMapper.findById(instrumentId);
        if (instrument == null) {
            throw new ResourceNotFoundException("Instrument", instrumentId);
        }
        return instrument;
    }
}
