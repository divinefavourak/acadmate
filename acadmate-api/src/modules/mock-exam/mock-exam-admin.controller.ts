import {
  Controller, Get, Post, Put, Delete, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MockExamService } from './mock-exam.service';
import {
  CreateMockExamDto, UpdateMockExamDto, AddParticipantDto,
  UploadQuestionsDto, ResolvePanicDto,
} from './dto';

@Controller('admin/mock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MockExamAdminController {
  constructor(private readonly service: MockExamService) {}

  // ── Mock exam CRUD ───────────────────────────────────────────────────────
  @Get()
  list() { return this.service.listMockExams(); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.getMockExam(id); }

  @Post()
  create(@Body() dto: CreateMockExamDto) { return this.service.createMockExam(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMockExamDto) {
    return this.service.updateMockExam(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.deleteMockExam(id); }

  // ── Participants ─────────────────────────────────────────────────────────
  @Get(':id/participants')
  listParticipants(@Param('id') id: string) { return this.service.listParticipants(id); }

  @Post(':id/participants')
  addParticipant(@Param('id') id: string, @Body() dto: AddParticipantDto) {
    return this.service.addParticipant(id, dto);
  }

  @Patch(':id/participants/:participantId/approve')
  approveParticipant(
    @Param('participantId') participantId: string,
    @Body('isApproved') isApproved: boolean,
  ) {
    return this.service.setParticipantApproval(participantId, isApproved);
  }

  @Delete(':id/participants/:participantId')
  removeParticipant(@Param('participantId') participantId: string) {
    return this.service.removeParticipant(participantId);
  }

  // ── Questions ────────────────────────────────────────────────────────────
  @Get(':id/questions')
  listQuestions(@Param('id') id: string) { return this.service.listQuestions(id); }

  @Post(':id/questions/upload')
  uploadQuestions(@Param('id') id: string, @Body() dto: UploadQuestionsDto) {
    return this.service.uploadQuestions(id, dto);
  }

  @Delete(':id/questions/:questionId')
  deleteQuestion(@Param('questionId') questionId: string) {
    return this.service.deleteQuestion(questionId);
  }

  // ── Results ──────────────────────────────────────────────────────────────
  @Get(':id/results')
  results(@Param('id') id: string) { return this.service.listResults(id); }

  // ── Panics ───────────────────────────────────────────────────────────────
  @Get(':id/panics')
  panics(@Param('id') id: string) { return this.service.listPanics(id); }

  @Get(':id/panics/count')
  panicCount(@Param('id') id: string) { return this.service.countUnresolvedPanics(id); }

  @Patch(':id/panics/:panicId')
  resolvePanic(@Param('panicId') panicId: string, @Body() dto: ResolvePanicDto) {
    return this.service.resolvePanic(panicId, dto.isResolved);
  }
}
