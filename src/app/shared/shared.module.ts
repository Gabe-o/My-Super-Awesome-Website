import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { GameOfLifeCanvasComponent } from './game-of-life-canvas/game-of-life-canvas.component';

const modules = [RouterModule, MatButtonModule, MatToolbarModule, MatIconModule, MatCardModule];

@NgModule({
  declarations: [GameOfLifeCanvasComponent],
  imports: [CommonModule, ...modules],
  exports: [...modules, GameOfLifeCanvasComponent],
})
export class SharedModule {}
