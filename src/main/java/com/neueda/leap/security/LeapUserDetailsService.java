package com.neueda.leap.security;

import com.neueda.leap.mappers.AppUserMapper;
import com.neueda.leap.services.domain.AppUser;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class LeapUserDetailsService implements UserDetailsService {

    private final AppUserMapper appUserMapper;

    public LeapUserDetailsService(AppUserMapper appUserMapper) {
        this.appUserMapper = appUserMapper;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppUser user = appUserMapper.findByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("Unknown user");
        }
        return new LeapUserPrincipal(user);
    }
}
