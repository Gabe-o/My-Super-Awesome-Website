import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { SharedModule } from '../shared/shared.module';

const components = [HomeComponent];

@NgModule({
  declarations: [...components],
  imports: [CommonModule, SharedModule],
  exports: [...components],
})
export class HomeModule {}
