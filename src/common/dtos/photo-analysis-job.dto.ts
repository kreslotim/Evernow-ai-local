import { AnalyzeType } from '@prisma/client';
import { IsString, IsNumber, IsOptional, IsObject, IsArray } from 'class-validator';

export class PhotoAnalysisJobDto {
  @IsString()
  id: string;

  @IsString()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  photoUrl: string[];

  @IsString()
  chatId: string;

  @IsNumber()
  messageId: number;

  @IsString()
  analysisType: AnalyzeType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export interface PhotoAnalysisJobResult {
  id: string;
  userId: string;
  chatId: string;
  messageId: number;
  analysisType: string;
  processingTime: number;
  description?: string;
  summary?: string;
  error?: string;
}
