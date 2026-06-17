import {
  Controller, Post, Get, Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { MockExamService } from './mock-exam.service';
import { MockParticipantGuard, MockParticipantPayload } from './guards/mock-participant.guard';
import {
  RegisterParticipantDto, LoginParticipantDto, SaveAnswerDto, PanicReportDto,
  StartSessionDto,
} from './dto';

interface AuthenticatedRequest extends Request {
  mockParticipant: MockParticipantPayload;
}

@Controller('mock')
export class MockExamController {
  constructor(private readonly service: MockExamService) {}

  /** Active exam info (public) */
  @Get('active')
  getActive() {
    return this.service.getActiveMockExam();
  }

  /** Public exam info by ID */
  @Get(':mockExamId/info')
  getExamInfo(@Param('mockExamId') mockExamId: string) {
    return this.service.getPublicMockExam(mockExamId);
  }

  /** Register — phone must already be on the approved list */
  @Post(':mockExamId/register')
  register(@Param('mockExamId') mockExamId: string, @Body() dto: RegisterParticipantDto) {
    return this.service.registerParticipant(mockExamId, dto);
  }

  /** Login → returns participant JWT */
  @Post(':mockExamId/login')
  login(@Param('mockExamId') mockExamId: string, @Body() dto: LoginParticipantDto) {
    return this.service.loginParticipant(mockExamId, dto);
  }

  /** Public leaderboard */
  @Get(':mockExamId/leaderboard')
  leaderboard(@Param('mockExamId') mockExamId: string) {
    return this.service.getLeaderboard(mockExamId);
  }

  // ── Authenticated participant routes ────────────────────────────────────

  /** Subject picker options (compulsory + electives) for the logged-in exam */
  @Get('subject-options')
  @UseGuards(MockParticipantGuard)
  subjectOptions(@Req() req: AuthenticatedRequest) {
    return this.service.getMockSubjects(req.mockParticipant.mockExamId, req.mockParticipant.sub);
  }

  /** Current in-progress session (for resume), or null */
  @Get('sessions/current')
  @UseGuards(MockParticipantGuard)
  currentSession(@Req() req: AuthenticatedRequest) {
    return this.service.getCurrentSession(req.mockParticipant.sub);
  }

  /** Start or resume a session */
  @Post('sessions')
  @UseGuards(MockParticipantGuard)
  startSession(@Req() req: AuthenticatedRequest, @Body() dto: StartSessionDto) {
    const { sub, mockExamId } = req.mockParticipant;
    return this.service.startSession(sub, mockExamId, dto.subjects);
  }

  /** Get session + questions (no answers) */
  @Get('sessions/:sessionId')
  @UseGuards(MockParticipantGuard)
  getSession(@Param('sessionId') sessionId: string) {
    return this.service.getSessionWithQuestions(sessionId);
  }

  /** Save a single answer */
  @Post('sessions/:sessionId/answer')
  @UseGuards(MockParticipantGuard)
  saveAnswer(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.service.saveAnswer(sessionId, req.mockParticipant.sub, dto);
  }

  /** Submit exam */
  @Post('sessions/:sessionId/submit')
  @UseGuards(MockParticipantGuard)
  submit(@Param('sessionId') sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.service.submitSession(sessionId, req.mockParticipant.sub);
  }

  /** Timer expired — auto-submit */
  @Post('sessions/:sessionId/timeout')
  @UseGuards(MockParticipantGuard)
  timeout(@Param('sessionId') sessionId: string) {
    return this.service.timeoutSession(sessionId);
  }

  /** Get result after submission */
  @Get('sessions/:sessionId/result')
  @UseGuards(MockParticipantGuard)
  result(@Param('sessionId') sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.service.getSessionResult(sessionId, req.mockParticipant.sub);
  }

  /** Panic button */
  @Post('panic')
  @UseGuards(MockParticipantGuard)
  panic(@Req() req: AuthenticatedRequest, @Body() dto: PanicReportDto) {
    const { sub, mockExamId } = req.mockParticipant;
    return this.service.sendPanicReport(sub, mockExamId, dto);
  }
}
