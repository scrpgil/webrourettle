import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Roulette } from './roulette/roulette';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Roulette],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'Web Wheel';
}
