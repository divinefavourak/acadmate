import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: `${process.env.API_URL ?? 'http://localhost:3001'}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    // User.email is required + unique; without it the downstream lookup would
    // hit the DB with `undefined`. Reject the flow cleanly instead.
    if (!email) {
      return done(
        new UnauthorizedException('Google account did not provide an email address'),
        false,
      );
    }
    const name = profile.displayName;
    const googleId = profile.id;
    const image = profile.photos?.[0]?.value;
    done(null, { email, name, googleId, image });
  }
}
