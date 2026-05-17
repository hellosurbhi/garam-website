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

interface InviteEmailProps {
  firstName: string;
  showCity: string;
  showDate: string;
  portalUrl: string;
}

const BRAND_RED = "#DC2626";
const CHARCOAL = "#1A1A1A";
const OFF_WHITE = "#FFF8F0";

const InviteEmail: FC<InviteEmailProps> = ({
  firstName,
  showCity,
  showDate,
  portalUrl,
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
            fontSize: 28,
            fontWeight: 700,
            color: CHARCOAL,
            fontFamily: "'Playfair Display', Georgia, serif",
            marginBottom: 8,
            textAlign: "center" as const,
          }}
        >
          You&apos;re cast, {firstName}.
        </Text>
        <Text
          style={{
            fontSize: 18,
            color: CHARCOAL,
            textAlign: "center" as const,
            lineHeight: "1.6",
            marginBottom: 8,
          }}
        >
          You&apos;ve been selected for Garam Masala Dating. This is your
          contestant packet.
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: "#666",
            textAlign: "center" as const,
            marginBottom: 32,
          }}
        >
          {showCity} · {showDate}
        </Text>
        <Section style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <Button
            href={portalUrl}
            style={{
              backgroundColor: BRAND_RED,
              color: "#fff",
              padding: "16px 40px",
              borderRadius: 50,
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "1.5px",
              textDecoration: "none",
            }}
          >
            Open Contestant Packet
          </Button>
        </Section>
        <Text
          style={{
            fontSize: 14,
            color: "#666",
            lineHeight: "1.6",
            marginBottom: 8,
          }}
        >
          Complete your production release first. After that, your prep guide
          opens with everything you need before showtime.
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "#666",
            lineHeight: "1.6",
            marginBottom: 8,
          }}
        >
          Please read it before arriving. This is the packet for your appearance
          on stage.
        </Text>
        <Text style={{ fontSize: 13, color: "#999", marginBottom: 32 }}>
          If the button doesn&apos;t work, copy this URL: {portalUrl}
        </Text>
        <Hr style={{ borderColor: "rgba(0,0,0,0.1)", marginBottom: 16 }} />
        <Text
          style={{ fontSize: 12, color: "#999", textAlign: "center" as const }}
        >
          Garam Masala Dating · contact@garammasaladating.com
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;
