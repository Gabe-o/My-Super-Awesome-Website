import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameOfLifeCanvasComponent } from './game-of-life-canvas.component';

describe('GameOfLifeCanvasComponent', () => {
  let component: GameOfLifeCanvasComponent;
  let fixture: ComponentFixture<GameOfLifeCanvasComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameOfLifeCanvasComponent]
    });
    fixture = TestBed.createComponent(GameOfLifeCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
