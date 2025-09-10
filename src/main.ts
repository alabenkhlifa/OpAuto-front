import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { AppRoutingModule } from './app/app-routing-module';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    importProvidersFrom(AppRoutingModule)
  ]
}).catch(err => console.error(err));
