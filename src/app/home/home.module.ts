import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { SharedModule } from '../shared/shared.module';
import { ProjectCardComponent } from './project-card/project-card.component';
import { FooterComponent } from './footer/footer.component';

const components = [HomeComponent];

@NgModule({
  declarations: [...components, ProjectCardComponent, FooterComponent],
  imports: [CommonModule, SharedModule],
  exports: [...components],
})
export class HomeModule {}
