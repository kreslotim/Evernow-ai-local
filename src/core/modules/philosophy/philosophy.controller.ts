import {Body, Controller, Get, Param, Post, Put, Query, UseGuards} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiTags} from "@nestjs/swagger";
import {FindAllPhilosophiesDto} from "./dto/find-all-philosophies.dto";
import {PhilosophyService} from "./philosophy.service";
import {CreatePhilosophyDto} from "./dto/create-philosophy.dto";
import {AdminAuthGuard} from "../../guards";

@ApiTags('Philosophy API')
@Controller('/philosophy')
@ApiBearerAuth('jwt')
@UseGuards(AdminAuthGuard)
export class PhilosophyController {
    constructor(private readonly philosophyService: PhilosophyService) {
    }

    @ApiOperation({summary: 'Find all philosophies'})
    @Get('/')
    async findAll(@Query() dto: FindAllPhilosophiesDto) {
        return await this.philosophyService.findAll(dto);
    }

    @ApiOperation({summary: 'Create philosophy'})
    @Post('/')
    async create(@Body() data: CreatePhilosophyDto) {
        return await this.philosophyService.create(data);
    }

    @ApiOperation({summary: 'Update philosophy'})
    @Put('/:id')
    async update(@Param('id') id: string, @Body() data: CreatePhilosophyDto) {
        return await this.philosophyService.update(id, data);
    }

    @ApiOperation({summary: 'Get philosophy'})
    @Get('/:id')
    async findOne(@Param('id') id: string) {
        return await this.philosophyService.findOne(id);
    }


}