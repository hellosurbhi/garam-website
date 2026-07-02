import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Img,
} from "@react-email/components";
import type { FC } from "react";
import { BRAND_LOGO_URL } from "@/data/brand";

interface PostShowProps {
  firstName: string;
  showCity: string;
  nextShowCity?: string;
  nextShowDate?: string;
  nextShowUrl?: string;
  unsubscribeUrl: string;
}

const BRAND_RED = "#DC2626";
const CHARCOAL = "#1A1A1A";
const OFF_WHITE = "#FFF8F0";

const PostShow: FC<PostShowProps> = ({
  firstName,
  showCity,
  nextShowCity,
  nextShowDate,
  nextShowUrl,
  unsubscribeUrl,
}) => (
  <Html lang="en">
    <Head />
    <Body
      style={{
        backgroundColor: OFF_WHITE,
        fontFamily: "'Nunito', Arial, sans-serif",
        margin: 0,
        padding: 0,
      }}
    >
      <Container
        style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}
      >
        <Img
          src={BRAND_LOGO_URL}
          alt="Garam Masala Dating"
          width={180}
          height={40}
          style={{ marginBottom: 32 }}
        />
        <Text
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: CHARCOAL,
            fontFamily: "'Playfair Display', Georgia, serif",
            marginBottom: 8,
          }}
        >
          Thanks for the laughs, {firstName}!
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: CHARCOAL,
            lineHeight: "1.6",
            marginBottom: 24,
          }}
        >
          Thank you for being part of the {showCity} show. You were incredible
          out there.
        </Text>
        <Section
          style={{
            backgroundColor: "#fff",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            padding: "24px 20px",
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: CHARCOAL,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            You&apos;re welcome back anytime, for free.
          </Text>
          <Text style={{ fontSize: 14, color: "#666", lineHeight: "1.6" }}>
            As a past contestant, you can attend any future show at no charge.
            Just email contact@garammasaladating.com and let us know which event
            you want to be added to.
          </Text>
        </Section>
        {nextShowCity && nextShowUrl && nextShowDate && (
          <Section style={{ textAlign: "center" as const, marginBottom: 32 }}>
            <Text style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Next show: {nextShowCity} · {nextShowDate}
            </Text>
            <Button
              href={nextShowUrl}
              style={{
                backgroundColor: BRAND_RED,
                color: "#fff",
                padding: "14px 32px",
                borderRadius: 50,
                fontSize: 14,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "1px",
                textDecoration: "none",
              }}
            >
              Get Tickets
            </Button>
          </Section>
        )}
        <Hr style={{ borderColor: "rgba(0,0,0,0.1)", marginBottom: 16 }} />
        <Text
          style={{ fontSize: 12, color: "#999", textAlign: "center" as const }}
        >
          Garam Masala Dating · contact@garammasaladating.com
        </Text>
        <Text
          style={{ fontSize: 11, color: "#bbb", textAlign: "center" as const }}
        >
          <a href={unsubscribeUrl} style={{ color: "#bbb" }}>
            Unsubscribe
          </a>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default PostShow;
