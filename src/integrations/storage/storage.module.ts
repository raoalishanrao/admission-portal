import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalObjectStorage } from './local-object.storage.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.interface.js';
import { S3ObjectStorage } from './s3-object.storage.js';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ObjectStorage => {
        const storageDriver = (
          config.get<string>('STORAGE_DRIVER') ?? process.env.STORAGE_DRIVER ?? 'local'
        ).toLowerCase();
        const StorageClass = ['s3', 'minio', 'b2', 'backblaze'].includes(storageDriver)
          ? S3ObjectStorage
          : LocalObjectStorage;
        return new StorageClass();
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
