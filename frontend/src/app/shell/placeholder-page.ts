import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Stands in for a feature page that has not been merged yet, so the shell is
 * runnable from the first pull request. Removed once every route is real.
 */
@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="empty">This screen has not been built yet.</p>`,
})
export class PlaceholderPage {}
