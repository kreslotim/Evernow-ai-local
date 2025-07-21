import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class FileService {
    private readonly baseUploadDir = join(process.cwd(), 'uploads');

    async saveFile(
        buffer: Buffer,
        originalName: string,
        folder: string,
    ): Promise<{
        filename: string;
        path: string;
        url: string;
    }> {
        if (!folder.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new BadRequestException('Invalid folder name');
        }

        const folderPath = join(this.baseUploadDir, folder);
        await this.ensureDir(folderPath);

        const ext = extname(originalName) || '.bin';
        const filename = `${Date.now()}-${randomUUID()}${ext}`;
        const fullPath = join(folderPath, filename);

        await fs.promises.writeFile(fullPath, buffer);

        return {
            filename,
            path: fullPath,
            url: `/uploads/${folder}/${filename}`,
        };
    }

    async deleteFile(url: string): Promise<void> {
        if (!url.startsWith('/uploads/')) {
            throw new BadRequestException('Invalid URL format');
        }

        const relativePath = url.slice('/uploads/'.length);

        const parts = relativePath.split('/');
        if (parts.length !== 2) {
            throw new BadRequestException('Invalid URL format');
        }

        const [folder, filename] = parts;

        if (!folder.match(/^[a-zA-Z0-9_-]+$/) || !filename.match(/^[a-zA-Z0-9-_.]+$/)) {
            throw new BadRequestException('Invalid folder or filename');
        }

        const filePath = join(this.baseUploadDir, folder, filename);

        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
        } catch {
            throw new NotFoundException('File not found');
        }

        await fs.promises.unlink(filePath);
    }


    private async ensureDir(path: string) {
        if (!fs.existsSync(path)) {
            await fs.promises.mkdir(path, { recursive: true });
        }
    }
}
