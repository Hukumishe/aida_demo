import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromptDto) {
    const existing = await this.prisma.prompt.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Промпт с ключом "${dto.key}" уже существует`);
    }
    return this.prisma.prompt.create({
      data: {
        key: dto.key,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.prompt.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.prompt.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException('Промпт не найден');
    }
    return prompt;
  }

  async update(id: string, dto: UpdatePromptDto) {
    await this.findOne(id);
    if (dto.key != null) {
      const existing = await this.prisma.prompt.findFirst({
        where: { key: dto.key, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Промпт с ключом "${dto.key}" уже существует`);
      }
    }
    return this.prisma.prompt.update({
      where: { id },
      data: {
        ...(dto.key != null && { key: dto.key }),
        ...(dto.description != null && { description: dto.description }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.prompt.delete({ where: { id } });
  }
}
