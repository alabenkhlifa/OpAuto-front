import { Module } from '@nestjs/common';
import { GarageSettingsService } from './garage-settings.service';
import { GarageSettingsController } from './garage-settings.controller';

@Module({ controllers: [GarageSettingsController], providers: [GarageSettingsService] })
export class GarageSettingsModule {}
