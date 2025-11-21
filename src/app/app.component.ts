import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'swiss-army-knife';
  isSmartFlowVisible = true;

  revealSmartFlow(): void {
    this.isSmartFlowVisible = true;
  }
}
