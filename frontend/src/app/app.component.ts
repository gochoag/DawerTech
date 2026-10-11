import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular';

@Component({
  selector: 'dt-root',
  standalone: true,
  imports: [IonApp, RouterOutlet],
  template: '<ion-app><router-outlet /></ion-app>',
})
export class AppComponent {}
