import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppRoutingModule } from './app/app-routing-module';
import { App } from './app/app';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { apiUrlInterceptor } from './app/core/interceptors/api-url.interceptor';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptors([apiUrlInterceptor, authInterceptor])),
    importProvidersFrom(AppRoutingModule)
  ]
}).catch(err => console.error(err));
