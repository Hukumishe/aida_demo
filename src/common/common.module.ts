import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Global()
@Module({
  providers: [PrismaService, HttpExceptionFilter],
  exports: [PrismaService, HttpExceptionFilter],
})
export class CommonModule {}




