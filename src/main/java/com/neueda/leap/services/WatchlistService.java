package com.neueda.leap.services;

import com.neueda.leap.mappers.WatchlistMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

@Service
public class WatchlistService {

    private final WatchlistMapper watchlistMapper;
    private final AccountService accountService;
    private final InstrumentService instrumentService;

    public WatchlistService(WatchlistMapper watchlistMapper, AccountService accountService,
                            InstrumentService instrumentService) {
        this.watchlistMapper = watchlistMapper;
        this.accountService = accountService;
        this.instrumentService = instrumentService;
    }

    /** The account's starred instrument ids, in display order. */
    public List<Integer> findInstrumentIds(int accountId) {
        // Unknown account -> 404, instead of an empty list that looks like "nothing starred".
        accountService.findById(accountId);
        return watchlistMapper.findInstrumentIds(accountId);
    }

    /**
     * Replaces the account's watchlist with `instrumentIds`, in that order.
     * Instruments that stay keep the date they were first starred.
     *
     * @throws InvalidWatchlistException if an id is listed twice
     * @throws ResourceNotFoundException if the account or an instrument does not exist
     */
    @Transactional
    public List<Integer> replace(int accountId, List<Integer> instrumentIds) {
        accountService.findById(accountId);
        if (new HashSet<>(instrumentIds).size() != instrumentIds.size()) {
            throw new InvalidWatchlistException("instrumentIds must not repeat an instrument");
        }
        for (int instrumentId : instrumentIds) {
            instrumentService.findById(instrumentId);
        }

        watchlistMapper.deleteExcept(accountId, instrumentIds);
        for (int position = 0; position < instrumentIds.size(); position++) {
            watchlistMapper.upsert(accountId, instrumentIds.get(position), position);
        }
        return watchlistMapper.findInstrumentIds(accountId);
    }
}
