import {ApiProperty} from "@nestjs/swagger";
import {IsOptional, IsString} from "class-validator";

export class PagesDto {
    @ApiProperty({title: 'Page', description: 'Page number', example: '1'})
    @IsOptional()
    @IsString()
    public page?: string;

    @ApiProperty({title: 'Page size', description: 'Items count per page', example: '15'})
    @IsOptional()
    @IsString()
    public limit?: string;
}