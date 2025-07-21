import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OfferService } from './offer.service';
import {
  CreateOfferDto,
  UpdateOfferDto,
  GetOffersQueryDto,
  OfferResponseDto,
  PaginatedOffersResponseDto,
  ApproveOfferDto,
  RejectOfferDto,
} from '../../../common/dtos/offer.dto';
import { AdminAuthGuard } from '../../guards';

@ApiTags('Offers')
@Controller('offers')
@ApiBearerAuth('jwt')
@UseGuards(AdminAuthGuard)
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new offer' })
  @ApiResponse({
    status: 201,
    description: 'Offer created successfully',
    type: OfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async createOffer(@Body() createOfferDto: CreateOfferDto): Promise<OfferResponseDto> {
    return await this.offerService.createOffer(createOfferDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of offers' })
  @ApiResponse({
    status: 200,
    description: 'Offers retrieved successfully',
    type: PaginatedOffersResponseDto,
  })
  async getOffers(@Query() query: GetOffersQueryDto): Promise<PaginatedOffersResponseDto> {
    return await this.offerService.getOffers(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get offer statistics' })
  @ApiResponse({
    status: 200,
    description: 'Offer statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total number of offers' },
        pending: { type: 'number', description: 'Number of pending offers' },
        approved: { type: 'number', description: 'Number of approved offers' },
        rejected: { type: 'number', description: 'Number of rejected offers' },
        last30Days: { type: 'number', description: 'Number of offers in the last 30 days' },
      },
    },
  })
  async getOfferStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    last30Days: number;
  }> {
    return await this.offerService.getOfferStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer by ID' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer retrieved successfully',
    type: OfferResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async getOfferById(@Param('id') id: string): Promise<OfferResponseDto> {
    return await this.offerService.getOfferById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update offer by ID' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer updated successfully',
    type: OfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async updateOffer(@Param('id') id: string, @Body() updateOfferDto: UpdateOfferDto): Promise<OfferResponseDto> {
    return await this.offerService.updateOffer(id, updateOfferDto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer approved successfully',
    type: OfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async approveOffer(@Param('id') id: string, @Body() approveOfferDto?: ApproveOfferDto): Promise<OfferResponseDto> {
    return await this.offerService.approveOffer(id, approveOfferDto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an offer' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer rejected successfully',
    type: OfferResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async rejectOffer(@Param('id') id: string, @Body() rejectOfferDto?: RejectOfferDto): Promise<OfferResponseDto> {
    return await this.offerService.rejectOffer(id, rejectOfferDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete offer by ID' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 204, description: 'Offer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async deleteOffer(@Param('id') id: string): Promise<void> {
    return await this.offerService.deleteOffer(id);
  }
}
