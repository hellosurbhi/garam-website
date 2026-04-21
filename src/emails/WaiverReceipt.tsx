import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
} from "@react-email/components";
import type { FC } from "react";
import { BRAND_LOGO_URL } from "@/data/brand";

interface WaiverReceiptProps {
  firstName: string;
  signature: string;
  signedAtIso: string;
  waiverText: string;
}

const CHARCOAL = "#1A1A1A";
const OFF_WHITE = "#FFF8F0";

const WaiverReceipt: FC<WaiverReceiptProps> = ({
  firstName,
  signature,
  signedAtIso,
  waiverText,
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
            fontSize: 22,
            fontWeight: 700,
            color: CHARCOAL,
            fontFamily: "'Playfair Display', Georgia, serif",
            marginBottom: 8,
          }}
        >
          Your signed waiver
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: CHARCOAL,
            lineHeight: "1.6",
            marginBottom: 24,
          }}
        >
          Hi {firstName}, here&apos;s a copy of the waiver you signed. Keep this
          for your records.
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
              fontSize: 13,
              color: "#666",
              lineHeight: "1.7",
              whiteSpace: "pre-wrap",
            }}
          >
            {waiverText}
          </Text>
        </Section>
        <Hr style={{ borderColor: "rgba(0,0,0,0.1)", marginBottom: 16 }} />
        <Text
          style={{
            fontSize: 14,
            color: CHARCOAL,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Electronically signed by: {signature}
        </Text>
        <Text style={{ fontSize: 13, color: "#666", marginBottom: 32 }}>
          Signed at: {signedAtIso}
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

export default WaiverReceipt;
