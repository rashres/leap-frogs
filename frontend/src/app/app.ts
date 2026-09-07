/**
 * Application shell: brand, top navigation, routed outlet.
 *
 * The market-session strip, data-source toggle and working-order badge arrive
 * with the services they read from, in a later pull request.
 *
 * [chore]
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
