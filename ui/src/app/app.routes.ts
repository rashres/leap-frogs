import { Routes } from '@angular/router';

const accountDetail = () => import('./features/accounts/account-detail-page').then((m) => m.AccountDetailPage);

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Overview · LEAP Console',
    loadComponent: () => import('./features/overview/overview-page').then((m) => m.OverviewPage),
  },
  { path: 'portfolio', title: 'Portfolio · LEAP Console', loadComponent: accountDetail },
  {
    path: 'accounts',
    title: 'Accounts · LEAP Console',
    loadComponent: () => import('./features/accounts/accounts-page').then((m) => m.AccountsPage),
  },
  { path: 'accounts/:id', title: 'Account · LEAP Console', loadComponent: accountDetail },
  {
    path: 'instruments',
    title: 'Instruments · LEAP Console',
    loadComponent: () => import('./features/instruments/instruments-page').then((m) => m.InstrumentsPage),
  },
  {
    path: 'orders',
    title: 'Orders · LEAP Console',
    loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
  },
  { path: '**', redirectTo: '' },
];
