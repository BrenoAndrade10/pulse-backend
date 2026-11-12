import { Injectable } from '@nestjs/common';

@Injectable()
export class LinkBotDetector {
  isBot(userAgent: string): boolean {
    return (
      !userAgent ||
      /WhatsApp|TelegramBot|facebookexternal|facebookcatalog|Facebot|Twitterbot|Slackbot|LinkedInBot|Discordbot|Googlebot|bingbot|Applebot|SkypeUriPreview|Pinterest|curl|wget/i.test(
        userAgent,
      )
    );
  }
}
