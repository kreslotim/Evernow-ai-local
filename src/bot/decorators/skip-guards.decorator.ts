import { SetMetadata } from '@nestjs/common';

export const SkipSubscription = () => SetMetadata('skipSubscription', true);

export const SkipBanCheck = () => SetMetadata('skipBanCheck', true);

export const SkipAllGuards = () => SetMetadata('skipAllGuards', true);
