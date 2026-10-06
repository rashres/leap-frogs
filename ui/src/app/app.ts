import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccountSwitcher } from './shared/account-switcher';
import { ApiStatusBadge } from './shared/api-status-badge';
import { ToastOutlet } from './shared/toast-outlet';

@Component({
  selector: 'leap-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AccountSwitcher, ApiStatusBadge, ToastOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly links = [
    { path: '/', label: 'Overview', exact: true },
    { path: '/portfolio', label: 'Portfolio', exact: false },
    { path: '/instruments', label: 'Instruments', exact: false },
    { path: '/orders', label: 'Orders', exact: false },
    { path: '/accounts', label: 'Accounts', exact: false },
  ];
}
