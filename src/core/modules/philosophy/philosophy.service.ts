import {PrismaService} from "../../prisma/prisma.service";
import {FindAllPhilosophiesDto} from "./dto/find-all-philosophies.dto";
import {Injectable, NotFoundException} from "@nestjs/common";
import {CreatePhilosophyDto} from "./dto/create-philosophy.dto";
import {UpdatePhilosophyDto} from "./dto/update-philosophy.dto";
import {Prisma} from "@prisma/client";

@Injectable()
export class PhilosophyService {
    constructor(private readonly prisma: PrismaService) {
    };

    async findAll(dto: FindAllPhilosophiesDto) {
        const page: number = +dto.page || 1;
        const limit: number = +dto.limit || 15;

        const where: Prisma.PhilosophyWhereInput = {};

        if (dto.search) {
            where.text = {
                contains: dto.search,
                mode: 'insensitive'
            }
        }

        const [items, total] = await Promise.all([
            this.prisma.philosophy.findMany({
                where,
                take: limit,
                skip: (page - 1) * limit
            }),
            this.prisma.philosophy.count({where})
        ])

        return {total, items}
    }

    async findOne(id: string) {
        try {
            return await this.prisma.philosophy.findUnique({where: {id}});
        } catch {
            throw new NotFoundException('Philosophy not found')
        }
    }

    async create(data: CreatePhilosophyDto) {
        return this.prisma.philosophy.create({data});
    }

    async update(id: string, data: UpdatePhilosophyDto) {
        try {
            return await this.prisma.philosophy.update({where: {id}, data});
        } catch (e) {
            throw new NotFoundException('Philosophy not found');
        }
    }
}