import {ApiProperty} from "@nestjs/swagger";
import {IsString} from "class-validator";

export class CreatePhilosophyDto {
    @ApiProperty({title: 'Philosophy text', description: 'Philosophy text value', example: 'Some text...'})
    @IsString()
    public text: string;
}