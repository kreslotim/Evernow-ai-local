import {PagesDto} from "../../../../common/dtos/pages.dto";
import {ApiProperty} from "@nestjs/swagger";
import {IsOptional, IsString} from "class-validator";

export class FindAllPhilosophiesDto extends PagesDto {
    @ApiProperty({title: 'Search value', description: 'Searches items by text'})
    @IsOptional()
    @IsString()
    search?: string;
}