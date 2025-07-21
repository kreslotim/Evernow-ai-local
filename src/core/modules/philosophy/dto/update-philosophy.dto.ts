import {ApiProperty} from "@nestjs/swagger";
import {IsOptional, IsString} from "class-validator";

export class UpdatePhilosophyDto {
    @ApiProperty({title: 'Philosophy text', description: 'Philosophy text value', example: 'Some text...'})
    @IsOptional()
    @IsString()
    public text?: string;
}