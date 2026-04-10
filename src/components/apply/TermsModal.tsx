import { Modal } from "@/components/ui/Modal";
import styles from "./TermsModal.module.css";

interface TermsModalProps {
  onClose: () => void;
  onAgree: () => void;
}

export function TermsModal({ onClose, onAgree }: TermsModalProps) {
  return (
    <Modal
      onClose={onClose}
      ariaLabelledby="terms-modal-title"
      className={styles.dialog}
    >
      <div className={styles.header}>
        <h2 id="terms-modal-title" className={styles.title}>
          Appearance Release &amp; Voluntary Participation Agreement
        </h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <p>
          1. I understand that Garam Masala Dating (&ldquo;Producer&rdquo;) is
          producing the live dating and comedy show entitled &ldquo;Garam Masala
          Dating&rdquo; (&ldquo;Program&rdquo;), and that Producer would like
          for me to voluntarily participate in the production of the Program and
          engage in all activities associated with my participation in the
          Program, including without limitation activities such as dating in
          front of a live audience that may be hazardous or damaging
          (&ldquo;Activity&rdquo;). In connection with my participation in the
          Activity, I hereby grant to Producer and any third party given
          permission by Producer the right to take motion and still pictures of
          me and record my voice and any sounds made by me, and to obtain other
          information about me, including but not limited to my name, likeness,
          photograph, voice, dialogue, sounds, biographical information, social
          media posts, blogs/vlogs, personal characteristics and other personal
          identification (&ldquo;Footage and Materials&rdquo;), and to use the
          Footage and Materials in and in connection with the development,
          production, distribution and exploitation of the Program and any other
          production, and in the advertisements, merchandising, publicity, and
          promotions for the Program, any other production and for any entity
          that may sponsor, advertise in or exhibit in any manner the Program,
          the Footage and Materials, or any other production
          (&ldquo;Advertisements&rdquo;). The Footage and Materials, the
          Program, and the Advertisements may be exploited throughout the
          universe at any time, in perpetuity, in any and all media, now known
          and hereafter devised, without any monetary compensation to me
          whatsoever. The rights granted herein shall also include the right to
          edit, delete, dub and fictionalize the Footage and Materials, the
          Program, and the Advertisements as Producer sees fit in
          Producer&rsquo;s sole discretion. I further understand and agree that
          third parties, including without limitation, news sources, may take
          motion and still pictures of me and record my voice and any sounds
          made by me, or otherwise use the Footage and Materials, the Program,
          and the Advertisements and my likeness as they see fit. Producer bears
          no responsibility for such third party use.
        </p>

        <p>
          2. I agree to participate in connection with the production of the
          Program and related materials as and to the extent requested by
          Producer on such dates and at such locations as Producer shall
          designate in its sole discretion, and which dates and locations
          Producer may change in its sole discretion. The Footage and Materials
          shall also include any and all material that I may create, write,
          provide or contribute to in connection with the Program at any time,
          including, without limitation, personal journals, photographs,
          webisodes, vlogs, blogs, video diaries, social media posts, emails,
          text/picture messages, and promotional/advertising spots for the
          Program, the exhibitor of the Program, its advertisers and sponsors,
          news sources and any of their respective products and services.
          Producer shall be the sole and exclusive owner of all rights
          (including without limitation all copyrights) in and to the Footage
          and Materials. Any and all such Footage and Materials shall be deemed
          &ldquo;works made for hire&rdquo; specially ordered as part of a
          motion picture or other audio-visual work, and I waive the exercise of
          any &ldquo;moral rights,&rdquo; &ldquo;droit moral,&rdquo; and any
          analogous rights, however denominated, in any jurisdiction of the
          world. To the extent I retain any interest in the Footage and
          Materials, I hereby grant and assign to Producer all rights of any
          nature in and to all such Footage and Materials. Furthermore, the
          rights granted to Producer include any so-called &ldquo;rental and
          lending&rdquo; or similar rights and any and all allied, ancillary and
          subsidiary rights (including, without limitation, remake, sequel,
          theatrical, digital, television, radio, publishing, merchandising,
          soundtrack album and other similar rights) for any purpose, by and in
          any media whether now known or hereafter devised, throughout the
          universe, in perpetuity, as part of the Program or otherwise.
        </p>

        <p>
          3. Producer has no obligation to me whatsoever. Without in any way
          limiting the foregoing, I acknowledge and agree that Producer is under
          no obligation to select me to participate in the Activity or to
          include the Activity or the Footage and Materials in the Program. If
          Producer deems necessary, I agree to negotiate in good faith
          additional waivers and release agreements, as requested by Producer.
        </p>

        <p>
          4. I represent and warrant the following: (a) I am over eighteen (18)
          years of age, in good health and have no medical, physical, or
          emotional condition that might interfere with my engaging in the
          Activity; (b) I am not a registered sex offender and have not been
          accused, indicted or convicted of any crime or committed any act of
          moral turpitude; (c) I will not be under the influence of any
          medication or drugs that might impair my physical or mental ability to
          engage in the Activity or that might impair my judgment while engaging
          in the Activity; (d) I am not currently, and during one (1) year from
          today do not intend to be, a candidate for any public office; (e) I
          have all necessary licenses, permits and other consents (if any)
          required to participate in the Activity and/or the Program; (f) my
          appearance in the Program is not a performance and is not employment
          and is not subject to any union or guild collective bargaining
          agreement, and does not entitle me to wages, salary, corporate
          benefits, unemployment or workers&rsquo; compensation benefits, or
          other compensation under any such collective bargaining agreement or
          otherwise; (g) I will follow and obey all local, city, state and
          federal laws in connection with my participation in the Program; (h)
          that I will not, nor will I assist, partner with, permit, or otherwise
          encourage others to, use, copy, distribute or otherwise exploit the
          Program and any elements thereof, in whole or in part, for any
          purpose, in any medium, throughout the world, in perpetuity; and (i)
          that I will not create any materials or programs which are
          substantially or confusingly similar to the Program or Activity or any
          elements thereof. I will not stalk, abuse, harass, threaten,
          intimidate, assault, rape, injure or damage any person or property and
          shall refrain from use of violence and other inappropriate behavior at
          all times.
        </p>

        <p>
          5. I understand that it may be a federal offense, unless disclosed to
          Producer prior to the exhibition of the Program, to give or agree to
          give any member of the production staff anything of value to arrange
          my appearance in the Program, or to accept anything of value to
          promote any product or service on air. I represent and warrant that I
          gave nothing of value nor did I agree to give anything of value to
          anyone so I could appear in the Program.
        </p>

        <p>
          6. I understand that I will not be paid for participating in the
          Activity, for appearing in the Program or Advertisements, or for
          giving Producer the rights listed in this Agreement. I hereby waive
          any and all rights I may have to any compensation whatsoever. I
          acknowledge that I am a volunteer and shall not be deemed to be an
          employee of Producer.
        </p>

        <p>
          7. I understand that in and in connection with the Program, I may
          reveal or relate, and other parties may reveal or relate, information
          about me of a personal, private, surprising, defamatory, disparaging,
          embarrassing or unfavorable nature. I further understand that my
          appearance, depiction, and portrayal in and in connection with the
          Program, and my actions and the actions of others displayed therein,
          may be disparaging, defamatory, embarrassing or of an otherwise
          unfavorable nature, and may expose me to public ridicule, humiliation
          or condemnation. I acknowledge and agree that Producer shall have the
          right (but not the obligation) to include any such information and any
          such appearance, depiction, portrayal, actions and statements in the
          Program or in any other exhibition or exploitation of the Footage and
          Materials and Advertisements.
        </p>

        <p>
          8. I understand that subsequent to the Program, it is my choice
          whether or not to continue any interaction, dating or relationship
          which arises out of the Program, and that any such interaction, dating
          and/or relationship bears inherent risks, including without limitation
          the risk of emotional or physical harm. I agree that such activity is
          solely and entirely at my own risk.
        </p>

        <p>
          9. I shall keep in strictest confidence and shall not disclose to any
          third party at any time any information or materials of any kind that
          I read, hear or otherwise acquire or learn in connection with or as a
          result of my participation on the Program (&ldquo;Confidential
          Information&rdquo;), including without limitation information
          concerning the Program, the Program participants, the venues or
          locations, the events contained in the Program or the outcome of any
          event. My obligations with respect to confidentiality shall continue
          in perpetuity or until terminated by Producer in writing.
        </p>

        <p>
          10. I agree not to make any commercial use of the fact that I appeared
          in the Program or that Producer used the Footage and Materials.
          Neither I nor anyone acting on my behalf shall at any time use any of
          Producer&rsquo;s names, logos, trade names or trademarks, including
          the title of the Program, for any purpose.
        </p>

        <p>
          11. In the event of a breach or default of this Release by Producer, I
          agree that my sole remedy shall be the right to seek money damages. I
          shall not seek injunctive or other equitable relief, or to rescind
          this Release or the rights granted herein, or to restrain in any
          manner the production, distribution, exhibition, advertising or any
          other exploitation of the Program. In no event shall Producer be
          liable for consequential, exemplary or punitive damages, or lost or
          anticipated profits.
        </p>

        <p>
          12. RELEASE, AGREEMENT NOT TO SUE AND INDEMNITY. I understand that my
          participation in the Activity and any subsequent interaction, dating
          and relationship is at my own risk. To the maximum extent permitted by
          law, I, for myself and on behalf of my heirs, executors, agents,
          successors or assigns, hereby release, hold harmless, and forever
          discharge Producer and each of their respective parent, subsidiary,
          related and affiliated entities, licensees, successors, assigns,
          sponsors and advertisers, and each of their respective officers,
          directors, principals, executives, agents, contractors, partners,
          shareholders, representatives and employees (&ldquo;Released
          Parties&rdquo;), from any and all claims, actions, damages, losses,
          liabilities, costs, expenses, injuries or causes of action whatsoever
          that in any way are caused by, arise out of or result from this
          Agreement, my appearance and participation in the Activity, the
          Footage and Materials, the Program, or in the Advertisements
          (including, but not limited to, personal injury, rights of privacy and
          publicity, defamation, or false light), regardless of whether caused
          by the negligence or willful misconduct of the Released Parties. I
          will defend, indemnify and hold the Released Parties harmless from any
          and all such claims and from any breach or alleged breach by me of any
          of the representations or warranties made in this Agreement.
        </p>

        <p>
          13. To the maximum extent permitted by law, I waive any and all rights
          I may have under Section 1542 of the Civil Code of California, and
          every like provision in any foreign jurisdiction. Section 1542
          provides: A GENERAL RELEASE DOES NOT EXTEND TO CLAIMS THAT THE
          CREDITOR OR RELEASING PARTY DOES NOT KNOW OR SUSPECT TO EXIST IN HIS
          OR HER FAVOR AT THE TIME OF EXECUTING THE RELEASE AND THAT, IF KNOWN
          BY HIM OR HER, WOULD HAVE MATERIALLY AFFECTED HIS OR HER SETTLEMENT
          WITH THE DEBTOR OR RELEASED PARTY.
        </p>

        <p>
          14. This Agreement shall be governed by and construed in accordance
          with the laws of the State of New York without regard to its rules on
          conflict of laws. Any disputes arising under this Agreement shall be
          resolved by binding arbitration in New York, New York pursuant to JAMS
          Arbitration Rules and Procedures.
        </p>

        <p>
          15. This is the complete and binding agreement between Producer and
          me, and it supersedes all prior understandings and communications with
          respect to its subject matter. The illegality, invalidity or
          unenforceability of any provision shall in no way affect the validity
          or enforceability of the remainder. This Agreement cannot be
          terminated, rescinded or amended except by a written agreement signed
          by both Producer and me.
        </p>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.agreeBtn} onClick={onAgree}>
          I Agree
        </button>
        <button type="button" className={styles.dismissBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
