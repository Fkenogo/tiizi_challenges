# Tiizi — Privacy Policy

> **PUBLICATION CANDIDATE — NOT YET APPROVED FOR PUBLICATION**
>
> **Version:** 1.0 (proposed) · **Effective date:** [to be set on Founder approval and publication]
>
> *Everything above the "INTERNAL" section at the end is proposed member-facing text. Bracketed items such as [to be confirmed] must be resolved before publication. The INTERNAL section is for the Founder and legal reviewers and must be removed before publication.*

## 1. About this policy

This policy explains in plain language what personal information Tiizi handles. It covers the current version of Tiizi (Version 2). Tiizi is operated by **MiledgeVentures** (see section 9).

Tiizi is for adults aged 18 and over. We do not intend to provide accounts to children.

Tiizi is currently an invitation-only pilot. You may have heard about it through an existing community, such as a WhatsApp group. **Tiizi does not connect to WhatsApp and does not import WhatsApp contacts, messages or group membership.** Tiizi only has the information you give it when you sign up and use it.

## 2. Information we handle

**Sign-in and account.** Tiizi uses Firebase, a Google service, to sign you in with email and password or with Google. Firebase holds your sign-in details and account email. Tiizi's own member record holds an internal member ID linked to your sign-in and does not store your email address. Your email is shown back to you in your Profile.

**Display name and name changes.** Your display name is stored in your member record. Each change is saved in a name-change history showing the previous name, the new name and the time. This history is kept.

**Groups.** Which Groups you have joined or asked to join, your membership role in each, and when. If you create a Group, its name, description, goals and norms, and whether it is private or public.

**Challenges and participation.** Challenges you create or join, the dates you joined, withdrew or rejoined, and your results. Each period of participation is a separate record.

**Activity measurements.** When you log an activity, Tiizi records what you did, the measurement (such as distance, time, repetitions or weight), and when. **Some of this information may reveal things about your health, fitness or wellbeing.** Log only what you are comfortable recording on Tiizi.

**Technical information.** Tiizi does not currently run its own analytics, advertising or tracking tools and does not use your device location. The providers in section 5 may keep standard technical logs of their own. Your browser may keep a small amount of data to run the app.

## 3. Why we use it

To sign you in and keep your account secure; to show your Profile; to run Groups, Challenges and participation; to calculate and show progress and results; to keep the service working and protect it from misuse; and to meet legal obligations. Using Tiizi does not mean you agree to all other uses of your information.

## 4. Who can see what

- Your Profile and account email are visible to you. Tiizi does not show your email address to other members.
- Information inside a Group or Challenge can be seen by other members and by the Group's Accountable Steward according to the Group's or Challenge's visibility and their role. This can include your participation and the results of your logged activity.
- Whether other members see your display name, and where, depends on the Group or Challenge and on Tiizi's current features. We will update this policy before that changes.
- MiledgeVentures can see limited administrative information, such as member IDs, roles, Group memberships and activity counts, to run and support the service.
- Private Groups are not listed in public Group discovery.

## 5. Providers and where information is held

Tiizi relies on outside providers to operate. Tiizi uses Firebase (Google) for sign-in. Providers for the database and for running the app: **[to be confirmed before publication]**. Countries where information is processed or stored, and any safeguards for transfers abroad: **[to be confirmed before publication]**. This policy does not state or promise any location.

## 6. Keeping and deleting information

Tiizi **cannot yet** delete an account or erase personal information on request. Group and Challenge records are kept so that results and histories stay accurate, and the name-change history is permanent. Records are linked to your member ID.

Retention periods, deletion procedures and backup lifetimes are **[to be confirmed before publication]**. We will not promise immediate deletion or a fixed deadline that Tiizi cannot meet.

You can generally leave Groups and withdraw from Challenges. The Accountable Steward of a Group cannot leave while responsible for it, and you cannot withdraw from a Challenge that has ended. Leaving or withdrawing ends your participation but is not account deletion, and earlier participation records can remain afterwards.

## 7. Your rights and requests

Subject to the law, you may ask to see the personal information Tiizi holds about you, to correct inaccurate information, to object to certain uses, and to ask for deletion where the law applies. You can change your display name yourself in your Profile.

For any other request, or for questions about your information, **email [support@tiizichallenges.com](mailto:support@tiizichallenges.com)** and say what you would like. Tiizi has no in-app request tool yet, so requests are handled by email. We will reply by email and explain what can be done. We may need to confirm your identity before sharing or changing account information, and some information may need to be kept for legal or record-keeping reasons. As noted in section 6, Tiizi cannot yet delete an account on request.

You may also contact Kenya's Office of the Data Protection Commissioner if you have a concern.

## 8. Security

Access to member data requires you to be signed in and is limited by role. No online service can promise perfect security. This policy makes no claims about certifications or audits.

## 9. Changes and contact

We may update this policy as Tiizi changes, and will tell members appropriately as the law requires.

Tiizi is operated by **MiledgeVentures**, a business registered in Burundi. Tiizi is designed mainly for members in Kenya. Kenyan registration is planned and not yet complete.

**Responsible organisation (data controller):** MiledgeVentures — [exact registered name and address to be confirmed]

**Privacy questions and requests:** [support@tiizichallenges.com](mailto:support@tiizichallenges.com)

---

## INTERNAL — drafting notes and review questions (remove before publication)

**Drafting notes**

- **WhatsApp (§1).** Verified at source level: no WhatsApp integration exists in the V2 app, API or functions. The sentence says Tiizi does not connect to or import from WhatsApp. It does not describe how invitations are sent.
- **Email and name visibility (§2, §4).** The member database has no email column, and the API does not expose email; the Profile screen reads it from the Firebase user. Name visibility is worded to stay true whether or not the minimum identity projection (MC-4) has shipped. Re-check §4 against the product at launch.
- **No own analytics (§2).** True of the V2 code and API at `cb5d771`. Provider-side logs are not verified.
- **Deletion (§6).** States the current limit plainly: nothing is deletable today, name history is permanent, and no retention periods are invented. The reduced pilot account-closure arrangement (FD-PILOT-01 §16.9) is not yet built. Update §6 only to what is built.
- **Cause payment-destination references** are not described because pilot Challenges do not enable Support-a-Cause (FD-PILOT-01 §16.8). Add them if that ever changes.
- **Not included:** any "we do not sell your information" statement (unverified commercial fact), retention periods, hosting countries, processor agreements, automated deletion or transfer arrangements.

**Remaining legal-review questions**

1. Exact controller description and registered name/address (the operating name stays "MiledgeVentures"). Is MiledgeVentures, a Burundi-registered business, the right controller while Kenyan registration is pending?
2. Whether Kenyan data protection law and ODPC registration apply, and any resulting notice content.
3. Lawful basis for ordinary data and for activity measurements that may reveal health information, and whether separate consent is required.
4. Hosting and database providers, processing countries and transfer safeguards (§5).
5. The statutory handling and timing for access, correction and erasure requests, and whether the email process and "cannot yet delete" statement are acceptable for the pilot.
6. Whether older retired versions (V1 routes still in the app bundle) need to be addressed.
7. Confirm the support mailbox is operational and who handles privacy requests.
8. Effective date and final Founder approval.
