import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeModule } from './home/home.module';
import { WebGPUCanvasComponent } from './webgpu-canvas/webgpu-canvas.component';
import { OverlayscrollbarsModule } from 'overlayscrollbars-ngx';

@NgModule({
  declarations: [AppComponent, WebGPUCanvasComponent],
  imports: [BrowserModule, AppRoutingModule, BrowserAnimationsModule, HomeModule, OverlayscrollbarsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
