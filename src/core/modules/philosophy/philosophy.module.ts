import {Module} from "@nestjs/common";
import {PhilosophyController} from "./philosophy.controller";
import {PhilosophyService} from "./philosophy.service";
import {PrismaModule} from "../../prisma/prisma.module";
import {JwtModule} from "@nestjs/jwt";

@Module({
    imports: [PrismaModule, JwtModule],
    controllers: [PhilosophyController],
    providers: [PhilosophyService]
})
export class PhilosophyModule {}