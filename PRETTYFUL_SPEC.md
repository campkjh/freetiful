# Prettyful — Complete System Specification

> Platform Type: Professional Marketplace (Soomgo / Kmong style)
> Target: No-code (Bubble.io) compatible, REST API, scalable cloud-native

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Authentication & Onboarding](#3-authentication--onboarding)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [System Architecture](#6-system-architecture)
7. [Core Workflows](#7-core-workflows)
8. [Pudding (Ranking Currency) System](#8-pudding-ranking-currency-system)
9. [Chat System Design](#9-chat-system-design)
10. [Quotation & Payment Flow](#10-quotation--payment-flow)
11. [Notification System](#11-notification-system)
12. [Admin Panel Specification](#12-admin-panel-specification)
13. [Third-party Integrations](#13-third-party-integrations)
14. [Scalability Considerations](#14-scalability-considerations)

---

## 1. System Overview

### 1.1 Platform Summary

Prettyful is a two-sided marketplace connecting **event professionals** (MCs, singers, show hosts) with **clients** seeking services for weddings, birthdays, and other events. It supports:

- Professional discovery and booking
- Real-time 1:1 and multi-quote chat
- In-platform payments with escrow
- A gamified ranking system (Pudding) driving profile visibility
- Business directory for venues and vendors

### 1.2 Core Modules

| Module | Description |
|---|---|
| Auth | Social + email login, multi-provider |
| User Management | General / Pro / Business / Admin roles |
| Pro Profile | Multi-step setup, media, services, FAQ |
| Business Profile | Registration-verified business pages |
| Matching | Multi-quote + single-inquiry request flow |
| Chat | Real-time messaging with rich media |
| Quotation | Pro-issued quotes with direct payment |
| Payments | Escrow-based payment & settlement |
| Pudding | Daily-reset ranking currency system |
| Schedule | Calendar for pros with block dates |
| Reviews | Post-completion rating system |
| Notifications | Push, in-app, SMS |
| Admin | Full platform management panel |

---

## 2. User Roles & Permissions

### 2.1 Role Hierarchy

```
Admin
  └── Business User (verified)
  └── Pro User (approved)
        └── General User (base)
```

### 2.2 Permission Matrix

| Feature | General | Pro | Business | Admin |
|---|---|---|---|---|
| Browse profiles | ✓ | ✓ | ✓ | ✓ |
| Send multi-request | ✓ | ✓ | — | ✓ |
| Send single inquiry | ✓ | ✓ | — | ✓ |
| Receive quotes | ✓ | — | — | ✓ |
| Send quotes | — | ✓ | — | ✓ |
| Create pro profile | — | ✓ | — | ✓ |
| Create business profile | — | — | ✓ | ✓ |
| Pudding system | — | ✓ | — | ✓ |
| Admin panel | — | — | — | ✓ |
| Manage categories | — | — | — | ✓ |
| Moderate reviews | — | — | — | ✓ |
| Settlement | — | ✓ | ✓ | ✓ |

---

## 3. Authentication & Onboarding

### 3.1 Social Providers

| Provider | SDK | Fields Retrieved |
|---|---|---|
| Kakao | Kakao SDK | nickname, email, profile_image |
| Google | Google OAuth 2.0 | name, email, picture |
| Apple | Sign in with Apple | name (first login only), email |
| Naver | Naver OAuth | name, email, mobile |
| Email | Custom | email, password (bcrypt) |

### 3.2 Onboarding Decision Tree

```
Login via provider
    │
    ├── First time? YES
    │     ├── Retrieve name from provider
    │     │     ├── Name present → use it
    │     │     └── Name absent → prompt input
    │     ├── Phone number missing? → prompt input
    │     ├── Create User record (role = general)
    │     └── Redirect to home
    │
    └── Returning? → Refresh tokens → Redirect to home
```

### 3.3 Pro User Conversion Flow

**Step 1 — Terms Agreement**

Required consents (all must be accepted):
- `privacy_policy` — Privacy Policy
- `personal_data_collection` — Personal Data Collection & Usage
- `third_party_sharing` — Third-party Data Sharing
- `marketing_consent` — Marketing (optional)
- `partner_terms` — Prettyful Partner Terms

**Step 2 — Referral Code**
- User may enter referral code (optional)
- If valid: referrer +8 pudding on new user activation
- Code stored; reward deferred until profile completion

**Step 3 — Profile Setup** (detailed in §4 and §7)

---

## 4. Database Schema

> Notation: PK = Primary Key, FK = Foreign Key, UQ = Unique, IDX = Index

---

### 4.1 Users & Auth

#### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | |
| role | ENUM('general','pro','business','admin') | NOT NULL, default 'general' | |
| name | VARCHAR(100) | NOT NULL | |
| phone | VARCHAR(20) | UQ | Normalized E.164 format |
| email | VARCHAR(255) | UQ | |
| email_verified | BOOLEAN | default false | |
| profile_image_url | TEXT | | |
| is_active | BOOLEAN | default true | |
| is_banned | BOOLEAN | default false | |
| ban_reason | TEXT | | |
| referral_code | VARCHAR(20) | UQ | Auto-generated on creation |
| referred_by_user_id | UUID | FK → users.id | |
| point_balance | INTEGER | default 0 | Separate from pudding |
| coupon_count | INTEGER | default 0 | Denormalized |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | default now() | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

#### `auth_providers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, NOT NULL | |
| provider | ENUM('kakao','google','apple','naver','email') | NOT NULL | |
| provider_user_id | VARCHAR(255) | NOT NULL | External UID |
| provider_email | VARCHAR(255) | | |
| access_token | TEXT | | Encrypted at rest |
| refresh_token | TEXT | | Encrypted at rest |
| token_expires_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |
| UNIQUE | (provider, provider_user_id) | | |

#### `terms_agreements`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| privacy_policy | BOOLEAN | NOT NULL | |
| personal_data_collection | BOOLEAN | NOT NULL | |
| third_party_sharing | BOOLEAN | NOT NULL | |
| marketing_consent | BOOLEAN | default false | |
| partner_terms | BOOLEAN | NOT NULL | |
| agreed_at | TIMESTAMPTZ | default now() | |
| ip_address | VARCHAR(45) | | For audit |

#### `sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| refresh_token_hash | VARCHAR(255) | UQ | |
| device_info | JSONB | | UA, platform |
| ip_address | VARCHAR(45) | | |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| created_at | TIMESTAMPTZ | default now() | |

---

### 4.2 Pro Profiles

#### `pro_profiles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, UQ | 1:1 |
| status | ENUM('draft','pending','approved','rejected','suspended') | default 'draft' | |
| gender | ENUM('male','female','other','prefer_not') | | |
| short_intro | VARCHAR(50) | | |
| main_experience | VARCHAR(50) | | |
| career_years | SMALLINT | CHECK(1-30) | |
| awards | VARCHAR(300) | | |
| detail_html | TEXT | | Naver Smart Editor HTML |
| youtube_url | VARCHAR(500) | | |
| is_nationwide | BOOLEAN | default false | |
| pudding_count | INTEGER | default 0 | Current pudding balance |
| pudding_rank | INTEGER | | Calculated daily |
| profile_views | INTEGER | default 0 | |
| response_rate | DECIMAL(5,2) | | % of inquiries responded |
| avg_rating | DECIMAL(3,2) | | Denormalized average |
| review_count | INTEGER | default 0 | |
| is_featured | BOOLEAN | default false | Admin toggle |
| rejection_reason | TEXT | | |
| approved_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | default now() | |

#### `pro_categories`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| category_id | UUID | FK → categories.id | |
| PRIMARY KEY | (pro_profile_id, category_id) | | |

#### `pro_event_categories`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| event_category_id | UUID | FK → event_categories.id | |
| PRIMARY KEY | (pro_profile_id, event_category_id) | | |

#### `pro_regions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| region_id | UUID | FK → regions.id | |
| PRIMARY KEY | (pro_profile_id, region_id) | | |

#### `pro_profile_images`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| image_url | TEXT | NOT NULL | WebP format |
| original_url | TEXT | | Pre-crop original |
| display_order | SMALLINT | NOT NULL | |
| has_face | BOOLEAN | default true | Face detection result |
| is_primary | BOOLEAN | default false | |
| created_at | TIMESTAMPTZ | default now() | |

#### `pro_languages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| pro_profile_id | UUID | FK → pro_profiles.id | |
| language_code | VARCHAR(10) | NOT NULL | ISO 639-1 |
| PRIMARY KEY | (pro_profile_id, language_code) | | |

#### `pro_company_experiences`

| Column | Type | Constraints | Description |
|---|---|---|---|
| pro_profile_id | UUID | FK → pro_profiles.id | |
| company_id | UUID | FK → companies.id | Admin-managed list |
| PRIMARY KEY | (pro_profile_id, company_id) | | |

#### `pro_services`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| base_price | INTEGER | | KRW |
| price_unit | ENUM('per_hour','per_event','custom') | | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |

#### `pro_faqs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| question | VARCHAR(500) | NOT NULL | |
| answer | TEXT | NOT NULL | |
| display_order | SMALLINT | | |

---

### 4.3 Business Profiles

#### `business_profiles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, UQ | |
| status | ENUM('draft','pending','approved','rejected') | default 'draft' | |
| business_name | VARCHAR(200) | NOT NULL | |
| registration_number | VARCHAR(20) | UQ | NICE API verified |
| business_type | VARCHAR(100) | | |
| address | TEXT | | Naver API formatted |
| address_detail | VARCHAR(200) | | |
| lat | DECIMAL(10,8) | | |
| lng | DECIMAL(11,8) | | |
| phone | VARCHAR(20) | | |
| description_html | TEXT | | HTML editor content |
| instagram_url | VARCHAR(500) | | |
| website_url | VARCHAR(500) | | |
| video_url | TEXT | | mp4, max 10MB |
| profile_views | INTEGER | default 0 | |
| approved_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | default now() | |

#### `business_categories`

| Column | Type | Constraints | Description |
|---|---|---|---|
| business_profile_id | UUID | FK → business_profiles.id | |
| category_id | UUID | FK → categories.id | |
| PRIMARY KEY | (business_profile_id, category_id) | | |

#### `business_images`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| business_profile_id | UUID | FK → business_profiles.id | |
| image_url | TEXT | NOT NULL | |
| display_order | SMALLINT | | max 5 |
| created_at | TIMESTAMPTZ | default now() | |

---

### 4.4 Admin-Controlled Reference Data

#### `categories`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| type | ENUM('pro','business') | NOT NULL | |
| name | VARCHAR(100) | NOT NULL | |
| name_en | VARCHAR(100) | | |
| icon_url | TEXT | | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |
| parent_id | UUID | FK → categories.id | Subcategory support |
| created_at | TIMESTAMPTZ | default now() | |

#### `event_categories`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| category_id | UUID | FK → categories.id | Parent pro category |
| name | VARCHAR(100) | NOT NULL | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |

#### `regions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(100) | NOT NULL | |
| name_en | VARCHAR(100) | | |
| is_nationwide | BOOLEAN | default false | |
| display_order | SMALLINT | | |

#### `style_options`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| category_id | UUID | FK → categories.id | |
| name | VARCHAR(100) | NOT NULL | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |

#### `personality_options`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(100) | NOT NULL | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |

#### `companies`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(200) | NOT NULL | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |

---

### 4.5 Matching & Inquiries

#### `match_requests`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | Requester |
| type | ENUM('multi','single') | NOT NULL | |
| category_id | UUID | FK → categories.id | Pro category |
| event_category_id | UUID | FK → event_categories.id | |
| event_date | DATE | | |
| event_time | TIME | | |
| event_location | TEXT | | |
| budget_min | INTEGER | | KRW |
| budget_max | INTEGER | | KRW |
| ai_generated_message | TEXT | | Final message sent |
| raw_user_input | JSONB | | Styles, personalities, notes |
| status | ENUM('open','matched','cancelled','expired') | default 'open' | |
| expires_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |

#### `match_request_styles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| match_request_id | UUID | FK → match_requests.id | |
| style_option_id | UUID | FK → style_options.id | |
| PRIMARY KEY | (match_request_id, style_option_id) | | |

#### `match_request_personalities`

| Column | Type | Constraints | Description |
|---|---|---|---|
| match_request_id | UUID | FK → match_requests.id | |
| personality_option_id | UUID | FK → personality_options.id | |
| PRIMARY KEY | (match_request_id, personality_option_id) | | |

#### `match_deliveries`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| match_request_id | UUID | FK → match_requests.id | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| status | ENUM('pending','viewed','replied','declined','expired') | default 'pending' | |
| delivered_at | TIMESTAMPTZ | default now() | |
| viewed_at | TIMESTAMPTZ | | |
| replied_at | TIMESTAMPTZ | | |

---

### 4.6 Quotations

#### `quotations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| user_id | UUID | FK → users.id | Recipient |
| match_delivery_id | UUID | FK → match_deliveries.id | If from match |
| chat_room_id | UUID | FK → chat_rooms.id | |
| amount | INTEGER | NOT NULL | KRW, min 300,000 |
| title | VARCHAR(200) | | |
| description | TEXT | | |
| event_date | DATE | | |
| event_time | TIME | | |
| event_location | TEXT | | |
| valid_until | TIMESTAMPTZ | | Quote expiry |
| status | ENUM('pending','accepted','paid','cancelled','refunded','expired') | default 'pending' | |
| payment_id | UUID | FK → payments.id | |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | default now() | |

---

### 4.7 Payments

#### `payments`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | Payer |
| pro_profile_id | UUID | FK → pro_profiles.id | Payee |
| quotation_id | UUID | FK → quotations.id | |
| amount | INTEGER | NOT NULL | |
| platform_fee | INTEGER | | Commission amount |
| platform_fee_rate | DECIMAL(5,2) | | % at time of payment |
| net_amount | INTEGER | | amount - platform_fee |
| currency | CHAR(3) | default 'KRW' | |
| method | ENUM('card','bank_transfer','kakao_pay','naver_pay','toss') | | |
| pg_provider | VARCHAR(50) | | e.g., 'toss_payments' |
| pg_transaction_id | VARCHAR(255) | UQ | |
| status | ENUM('pending','completed','failed','refunded','partial_refund','escrowed','settled') | default 'pending' | |
| escrow_released_at | TIMESTAMPTZ | | After event completion |
| settled_at | TIMESTAMPTZ | | When paid to pro |
| refund_amount | INTEGER | | |
| refund_reason | TEXT | | |
| refunded_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |
| updated_at | TIMESTAMPTZ | default now() | |

#### `settlements`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| period_start | DATE | NOT NULL | |
| period_end | DATE | NOT NULL | |
| total_amount | INTEGER | | |
| status | ENUM('pending','processing','completed','failed') | default 'pending' | |
| bank_code | VARCHAR(10) | | |
| account_number | VARCHAR(30) | | Encrypted |
| account_holder | VARCHAR(100) | | |
| processed_at | TIMESTAMPTZ | | |

#### `refund_accounts`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, UQ | |
| bank_code | VARCHAR(10) | NOT NULL | |
| account_number | VARCHAR(30) | NOT NULL | Encrypted |
| account_holder | VARCHAR(100) | NOT NULL | |
| is_verified | BOOLEAN | default false | |
| created_at | TIMESTAMPTZ | default now() | |

---

### 4.8 Scheduling

#### `pro_schedules`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| date | DATE | NOT NULL | |
| status | ENUM('available','unavailable','booked','pending') | default 'available' | |
| payment_id | UUID | FK → payments.id | If booked |
| source | ENUM('manual','system') | default 'manual' | |
| note | VARCHAR(200) | | |
| UNIQUE | (pro_profile_id, date) | | |

---

### 4.9 Chat System

#### `chat_rooms`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| type | ENUM('inquiry','support') | default 'inquiry' | |
| user_id | UUID | FK → users.id | General user side |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| match_request_id | UUID | FK → match_requests.id | Optional origin |
| last_message_id | UUID | FK → messages.id | Denormalized |
| last_message_at | TIMESTAMPTZ | | |
| user_deleted_at | TIMESTAMPTZ | | Soft delete per user |
| pro_deleted_at | TIMESTAMPTZ | | Soft delete per pro |
| created_at | TIMESTAMPTZ | default now() | |

#### `messages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| room_id | UUID | FK → chat_rooms.id, IDX | |
| sender_id | UUID | FK → users.id | |
| type | ENUM('text','image','file','location','link','sticker','system') | NOT NULL | |
| content | TEXT | | Text content |
| metadata | JSONB | | Rich content payload (see below) |
| reply_to_id | UUID | FK → messages.id | |
| is_edited | BOOLEAN | default false | |
| edited_at | TIMESTAMPTZ | | |
| is_deleted | BOOLEAN | default false | |
| deleted_at | TIMESTAMPTZ | | |
| media_expires_at | TIMESTAMPTZ | | +20 days for media |
| created_at | TIMESTAMPTZ | default now() | IDX |

**metadata JSONB schema by type:**

```json
// image
{ "url": "...", "thumbnail_url": "...", "width": 800, "height": 600, "file_size": 102400 }

// file
{ "url": "...", "filename": "contract.pdf", "file_size": 204800, "mime_type": "application/pdf" }

// location
{ "lat": 37.5665, "lng": 126.978, "address": "서울특별시 중구 ...", "place_name": "서울시청" }

// link
{ "url": "...", "title": "...", "description": "...", "image_url": "..." }

// sticker
{ "sticker_id": "uuid", "pack_id": "uuid", "url": "..." }

// system
{ "event": "quotation_sent", "ref_id": "uuid" }
```

#### `message_reads`

| Column | Type | Constraints | Description |
|---|---|---|---|
| message_id | UUID | FK → messages.id | |
| user_id | UUID | FK → users.id | |
| read_at | TIMESTAMPTZ | default now() | |
| PRIMARY KEY | (message_id, user_id) | | |

#### `message_reactions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| message_id | UUID | FK → messages.id | |
| user_id | UUID | FK → users.id | |
| emoji | VARCHAR(10) | NOT NULL | Unicode emoji |
| created_at | TIMESTAMPTZ | default now() | |
| UNIQUE | (message_id, user_id, emoji) | | |

#### `chat_room_members`

| Column | Type | Constraints | Description |
|---|---|---|---|
| room_id | UUID | FK → chat_rooms.id | |
| user_id | UUID | FK → users.id | |
| is_favorited | BOOLEAN | default false | |
| last_read_at | TIMESTAMPTZ | | |
| unread_count | INTEGER | default 0 | Denormalized |
| PRIMARY KEY | (room_id, user_id) | | |

---

### 4.10 Reviews

#### `reviews`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| payment_id | UUID | FK → payments.id, UQ | One per payment |
| reviewer_id | UUID | FK → users.id | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| rating_satisfaction | SMALLINT | CHECK(1-5) | |
| rating_composition | SMALLINT | CHECK(1-5) | MC program |
| rating_experience | SMALLINT | CHECK(1-5) | Professionalism |
| rating_appearance | SMALLINT | CHECK(1-5) | |
| rating_voice | SMALLINT | CHECK(1-5) | |
| rating_wit | SMALLINT | CHECK(1-5) | |
| avg_rating | DECIMAL(3,2) | | Computed on insert |
| comment | TEXT | | |
| is_anonymous | BOOLEAN | default false | |
| is_visible | BOOLEAN | default true | Admin can hide |
| admin_created | BOOLEAN | default false | |
| pro_reply | TEXT | | |
| pro_replied_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |

#### `review_reports`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| review_id | UUID | FK → reviews.id | |
| reporter_id | UUID | FK → users.id | |
| reason | ENUM('spam','offensive','false','other') | NOT NULL | |
| description | TEXT | | |
| status | ENUM('pending','resolved','dismissed') | default 'pending' | |
| resolved_by | UUID | FK → users.id | Admin |
| created_at | TIMESTAMPTZ | default now() | |

---

### 4.11 Pudding System

#### `pudding_transactions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id, IDX | |
| type | ENUM('earn','reset','admin_grant','admin_deduct') | NOT NULL | |
| amount | INTEGER | NOT NULL | Can be negative |
| reason | ENUM('quote_reply_single','quote_reply_multi','successful_match','perfect_review','info_registered','referral_joined') | | |
| reference_id | UUID | | Related entity id |
| balance_after | INTEGER | NOT NULL | |
| note | TEXT | | Admin notes |
| created_at | TIMESTAMPTZ | default now() | IDX |

#### `pudding_rankings`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| pro_profile_id | UUID | FK → pro_profiles.id | |
| rank_date | DATE | NOT NULL | |
| rank | INTEGER | NOT NULL | |
| pudding_count | INTEGER | NOT NULL | Snapshot at ranking time |
| PRIMARY KEY | (pro_profile_id, rank_date) | | |

---

### 4.12 Notifications

#### `notifications`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, IDX | |
| type | ENUM('chat','booking','payment','review','system','marketing') | NOT NULL | |
| title | VARCHAR(200) | | |
| body | TEXT | | |
| data | JSONB | | Deep link payload |
| is_read | BOOLEAN | default false | |
| read_at | TIMESTAMPTZ | | |
| sent_push | BOOLEAN | default false | |
| created_at | TIMESTAMPTZ | default now() | IDX |

#### `push_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| token | TEXT | NOT NULL | FCM/APNs token |
| platform | ENUM('ios','android','web') | NOT NULL | |
| is_active | BOOLEAN | default true | |
| created_at | TIMESTAMPTZ | default now() | |
| UNIQUE | (user_id, token) | | |

#### `notification_settings`

| Column | Type | Constraints | Description |
|---|---|---|---|
| user_id | UUID | FK → users.id, PK | |
| chat_push | BOOLEAN | default true | |
| booking_push | BOOLEAN | default true | |
| payment_push | BOOLEAN | default true | |
| review_push | BOOLEAN | default true | |
| system_push | BOOLEAN | default true | |
| marketing_push | BOOLEAN | default false | |
| marketing_sms | BOOLEAN | default false | |
| marketing_email | BOOLEAN | default false | |

---

### 4.13 Favorites

#### `favorites`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| target_type | ENUM('pro','business') | NOT NULL | |
| target_id | UUID | NOT NULL | pro_profiles.id or business_profiles.id |
| created_at | TIMESTAMPTZ | default now() | |
| UNIQUE | (user_id, target_type, target_id) | | |

---

### 4.14 Points & Coupons

#### `point_transactions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, IDX | |
| type | ENUM('earn','spend','expire','admin_grant','admin_deduct') | NOT NULL | |
| amount | INTEGER | NOT NULL | |
| reason | VARCHAR(200) | | |
| reference_id | UUID | | |
| balance_after | INTEGER | NOT NULL | |
| expires_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | default now() | |

#### `coupons`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| code | VARCHAR(30) | UQ | |
| type | ENUM('percentage','fixed') | NOT NULL | |
| value | INTEGER | NOT NULL | % or KRW |
| min_order_amount | INTEGER | | |
| max_discount_amount | INTEGER | | For % type |
| valid_from | TIMESTAMPTZ | | |
| valid_until | TIMESTAMPTZ | | |
| total_quantity | INTEGER | | null = unlimited |
| used_count | INTEGER | default 0 | |
| is_active | BOOLEAN | default true | |
| created_at | TIMESTAMPTZ | default now() | |

#### `user_coupons`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id | |
| coupon_id | UUID | FK → coupons.id | |
| is_used | BOOLEAN | default false | |
| used_at | TIMESTAMPTZ | | |
| payment_id | UUID | FK → payments.id | |
| created_at | TIMESTAMPTZ | default now() | |

---

### 4.15 Admin & CMS

#### `announcements`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| title | VARCHAR(300) | NOT NULL | |
| content | TEXT | | HTML |
| target | ENUM('all','general','pro','business') | default 'all' | |
| is_pinned | BOOLEAN | default false | |
| is_published | BOOLEAN | default false | |
| published_at | TIMESTAMPTZ | | |
| created_by | UUID | FK → users.id | Admin |
| created_at | TIMESTAMPTZ | default now() | |

#### `faqs` (Admin-managed global FAQs)

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| category | VARCHAR(100) | | |
| question | VARCHAR(500) | NOT NULL | |
| answer | TEXT | NOT NULL | |
| target | ENUM('all','general','pro','business') | default 'all' | |
| display_order | SMALLINT | | |
| is_active | BOOLEAN | default true | |

#### `reports`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| reporter_id | UUID | FK → users.id | |
| target_type | ENUM('user','pro_profile','message','review') | NOT NULL | |
| target_id | UUID | NOT NULL | |
| reason | ENUM('spam','harassment','fake','inappropriate','other') | NOT NULL | |
| description | TEXT | | |
| status | ENUM('pending','under_review','resolved','dismissed') | default 'pending' | |
| resolved_by | UUID | FK → users.id | Admin |
| resolution_note | TEXT | | |
| created_at | TIMESTAMPTZ | default now() | |

#### `admin_audit_logs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| admin_id | UUID | FK → users.id | |
| action | VARCHAR(100) | NOT NULL | e.g., 'approve_pro' |
| target_type | VARCHAR(50) | | |
| target_id | UUID | | |
| before_state | JSONB | | |
| after_state | JSONB | | |
| ip_address | VARCHAR(45) | | |
| created_at | TIMESTAMPTZ | default now() | |

---

## 5. API Endpoints

> Base: `/api/v1`
> Auth: Bearer JWT unless noted as `[public]`
> Format: JSON

---

### 5.1 Authentication

```
POST   /auth/login/kakao          [public]  OAuth code exchange
POST   /auth/login/google         [public]  OAuth code exchange
POST   /auth/login/apple          [public]  Apple identity token
POST   /auth/login/naver          [public]  OAuth code exchange
POST   /auth/login/email          [public]  email + password
POST   /auth/register/email       [public]  Create account
POST   /auth/logout
POST   /auth/refresh              [public]  Refresh JWT
POST   /auth/password/reset       [public]
POST   /auth/password/confirm     [public]
GET    /auth/me                             Current user
PUT    /auth/me                             Update profile
POST   /auth/terms                          Accept terms
```

### 5.2 User Management

```
GET    /users/:id/profile         [public]  Public profile
PUT    /users/me/profile
PUT    /users/me/phone
PUT    /users/me/refund-account
GET    /users/me/linked-accounts
DELETE /users/me/linked-accounts/:provider
GET    /users/me/points
GET    /users/me/coupons
POST   /users/me/coupons/redeem
GET    /users/me/purchase-history
GET    /users/me/payment-history
POST   /users/me/invite           Generate invite link (+500 pts on friend signup)
GET    /users/me/notifications
PUT    /users/me/notifications/settings
PUT    /users/me/notifications/:id/read
POST   /users/me/notifications/read-all
```

### 5.3 Pro Profile

```
# Setup
POST   /pro/profile               Create/init profile (triggers conversion)
PUT    /pro/profile               Update profile
GET    /pro/profile               Own profile (includes draft)
POST   /pro/profile/submit        Submit for admin approval
POST   /pro/profile/draft         Save as draft

# Images
POST   /pro/profile/images        Upload image (multipart/form-data)
PUT    /pro/profile/images/:id    Reorder / set primary
DELETE /pro/profile/images/:id

# Services
GET    /pro/profile/services
POST   /pro/profile/services
PUT    /pro/profile/services/:id
DELETE /pro/profile/services/:id
PUT    /pro/profile/services/reorder

# FAQs
GET    /pro/profile/faqs
POST   /pro/profile/faqs
PUT    /pro/profile/faqs/:id
DELETE /pro/profile/faqs/:id

# Schedule
GET    /pro/schedule                        Own calendar view
POST   /pro/schedule/block         Block date manually
DELETE /pro/schedule/block/:date   Unblock date
GET    /pro/schedule/bookings      Confirmed bookings

# Pudding
GET    /pro/pudding                Balance + history
GET    /pro/pudding/rank           Current rank + nearby

# Analytics
GET    /pro/analytics/views        Profile view trend
GET    /pro/analytics/inquiries    Inquiry stats
GET    /pro/analytics/conversions  Match → booking rate

# Inquiries
GET    /pro/inquiries              All / multi / single filter
GET    /pro/inquiries/:id
POST   /pro/inquiries/:id/reply    Reply (triggers +pudding)
```

### 5.4 Business Profile

```
POST   /business/profile
PUT    /business/profile
GET    /business/profile
POST   /business/profile/submit
POST   /business/verify-registration    NICE API proxy

# Images
POST   /business/profile/images
DELETE /business/profile/images/:id
PUT    /business/profile/images/reorder

# Analytics
GET    /business/analytics/views
```

### 5.5 Discovery (Public)

```
GET    /pros                [public]  List professionals (paginated, filtered, sorted)
  ?category_id=
  ?event_category_id=
  ?region_id=
  ?sort=pudding_rank|avg_rating|review_count|newest
  ?page=&limit=

GET    /pros/:id            [public]  Detail page
GET    /pros/:id/reviews    [public]
GET    /pros/:id/schedule   [public]  Available dates
GET    /pros/recommended    [public]  Algorithm-based

GET    /businesses          [public]
  ?category_id=
  ?region=
  ?sort=newest|most_viewed

GET    /businesses/:id      [public]
```

### 5.6 Matching

```
# Multi-request
POST   /match/requests              Create multi-request (AI message gen)
GET    /match/requests              User's own requests
GET    /match/requests/:id
DELETE /match/requests/:id          Cancel
GET    /match/requests/:id/replies  See which pros replied

# Single inquiry
POST   /inquiries                   Single inquiry to specific pro
GET    /inquiries/:id
```

### 5.7 Quotations

```
GET    /quotations                  User's received quotes
GET    /pro/quotations              Pro's sent quotes
POST   /pro/quotations              Send quote (min 300,000 KRW)
PUT    /pro/quotations/:id          Edit if not yet paid
DELETE /pro/quotations/:id          Withdraw
POST   /quotations/:id/accept       User accepts
POST   /quotations/:id/pay          Initiate payment
```

### 5.8 Payments

```
POST   /payments/initiate           Create payment intent
POST   /payments/confirm            PG webhook confirmation
POST   /payments/cancel             Before event
POST   /payments/:id/refund         Refund request
GET    /payments/:id                Payment detail
POST   /payments/:id/release-escrow  Release after event (auto via scheduler)

# Webhook endpoints (PG callbacks)
POST   /webhooks/toss               [internal]
POST   /webhooks/kakaopay           [internal]
```

### 5.9 Chat

```
GET    /chat/rooms                  List rooms (sorted by last_message_at)
  ?search=                          Full-text search
  ?from_date=&to_date=              Date filter
POST   /chat/rooms                  Create room (single inquiry creates room)
GET    /chat/rooms/:id              Room detail
DELETE /chat/rooms/:id              Soft-delete from own side
PUT    /chat/rooms/:id/favorite     Toggle favorite
GET    /chat/rooms/:id/messages     Paginated messages
  ?before=<message_id>
POST   /chat/rooms/:id/messages     Send message
PUT    /chat/rooms/:id/messages/:mid Edit message
DELETE /chat/rooms/:id/messages/:mid Delete message
POST   /chat/rooms/:id/messages/:mid/react  Add emoji reaction
DELETE /chat/rooms/:id/messages/:mid/react/:emoji
POST   /chat/rooms/:id/read         Mark up to message_id as read
GET    /chat/rooms/:id/media        Photo gallery (images only, paginated)
```

### 5.10 Reviews

```
POST   /reviews                     Post review (payment must be completed)
PUT    /reviews/:id                 Edit own review
GET    /pros/:id/reviews            Pro's reviews list
POST   /reviews/:id/report          Report review
POST   /pro/reviews/:id/reply       Pro replies to review
```

### 5.11 Favorites

```
GET    /favorites
POST   /favorites
  { target_type: 'pro'|'business', target_id: uuid }
DELETE /favorites/:id
```

### 5.12 Reference Data

```
GET    /categories          [public]  ?type=pro|business
GET    /event-categories    [public]  ?category_id=
GET    /regions             [public]
GET    /style-options       [public]  ?category_id=
GET    /personality-options [public]
GET    /companies           [public]
GET    /sticker-packs       [public]
```

### 5.13 CMS & Support

```
GET    /announcements       [public]  Paginated
GET    /announcements/:id   [public]
GET    /faqs                [public]  ?target=&category=
GET    /terms/:slug         [public]  Privacy policy etc.
POST   /support/tickets
GET    /support/tickets
GET    /support/tickets/:id
POST   /support/tickets/:id/messages
```

### 5.14 Admin Endpoints

```
# All require role=admin

# Users
GET    /admin/users
GET    /admin/users/:id
PUT    /admin/users/:id
POST   /admin/users/:id/ban
POST   /admin/users/:id/unban
POST   /admin/users/:id/grant-points

# Pro Approval
GET    /admin/pro-applications        ?status=pending|approved|rejected
PUT    /admin/pro-applications/:id    { status, rejection_reason }

# Business Approval
GET    /admin/business-applications
PUT    /admin/business-applications/:id

# Categories
GET    /admin/categories
POST   /admin/categories
PUT    /admin/categories/:id
DELETE /admin/categories/:id
PUT    /admin/categories/reorder

# Same pattern for event-categories, style-options, personality-options, companies

# Reviews
GET    /admin/reviews
PUT    /admin/reviews/:id              { is_visible }
POST   /admin/reviews                  Admin creates review

# Reports
GET    /admin/reports
PUT    /admin/reports/:id              { status, resolution_note }

# Pudding
GET    /admin/pudding/rankings         Today's ranking
POST   /admin/pudding/grant            Manual grant
POST   /admin/pudding/trigger-reset    Manual trigger daily job

# Payments & Settlement
GET    /admin/payments
GET    /admin/settlements
POST   /admin/settlements/:id/process

# Announcements / FAQs
POST   /admin/announcements
PUT    /admin/announcements/:id
DELETE /admin/announcements/:id

# Coupons
POST   /admin/coupons
PUT    /admin/coupons/:id
GET    /admin/coupons

# Audit
GET    /admin/audit-logs
```

---

## 6. System Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CDN (CloudFront)                        │
│                   Static assets / WebP images                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer (ALB)                          │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
    ┌──────▼───────┐                   ┌──────▼──────┐
    │  Web App     │                   │ Admin Panel │
    │  (Next.js)   │                   │  (Next.js)  │
    └──────┬───────┘                   └──────┬──────┘
           │ REST + WebSocket                  │ REST
    ┌──────▼──────────────────────────────────▼──────┐
    │              API Gateway                        │
    │        (Rate limiting, Auth validation)         │
    └──────┬──────────────────────────────────────────┘
           │
    ┌──────▼─────────────────────────────────────────────────────┐
    │                    Core API Server (Node.js / NestJS)      │
    │                                                             │
    │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
    │  │ Auth Svc  │ │ User Svc │ │ Chat Svc │ │ Payment Svc │  │
    │  └───────────┘ └──────────┘ └──────────┘ └─────────────┘  │
    │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
    │  │ Match Svc │ │ Pro Svc  │ │Notif Svc │ │ Admin Svc   │  │
    │  └───────────┘ └──────────┘ └──────────┘ └─────────────┘  │
    └──────┬──────────────────────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────────────────┐
    │                    Data Layer                               │
    │  ┌──────────────┐  ┌───────────┐  ┌───────────────────┐    │
    │  │  PostgreSQL  │  │   Redis   │  │  Elasticsearch    │    │
    │  │  (Primary DB)│  │ (Cache,   │  │  (Pro search,     │    │
    │  │              │  │  Sessions,│  │   Chat FTS)        │    │
    │  │  Read Replica│  │  Pub/Sub) │  │                   │    │
    │  └──────────────┘  └───────────┘  └───────────────────┘    │
    └──────────────────────────────────────────────────────────────┘
           │
    ┌──────▼─────────────────────────────────────────────────────┐
    │                   Background Workers                        │
    │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
    │  │  Bull Queue  │  │  Scheduler    │  │  Event Stream   │  │
    │  │  (Jobs)      │  │  (Cron jobs)  │  │  (Kafka/SQS)    │  │
    │  └──────────────┘  └───────────────┘  └─────────────────┘  │
    └─────────────────────────────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────────────────┐
    │               External Services                              │
    │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐  │
    │  │   AWS S3 │ │   FCM    │ │ Toss Pay  │ │ NICE / Naver│  │
    │  │ (Media)  │ │  (Push)  │ │ (PG)      │ │ Address API │  │
    │  └──────────┘ └──────────┘ └───────────┘ └─────────────┘  │
    │  ┌──────────┐ ┌──────────┐ ┌───────────┐                   │
    │  │Face API  │ │ Claude   │ │  Naver    │                   │
    │  │(AWS Rek) │ │ (AI Msg) │ │ SmartEdit │                   │
    │  └──────────┘ └──────────┘ └───────────┘                   │
    └─────────────────────────────────────────────────────────────┘
```

### 6.2 Frontend Architecture

```
Prettyful Web / App (Next.js 14 App Router)
├── /app
│   ├── (auth)/login              # Social login redirect handlers
│   ├── (auth)/onboarding         # Name/phone collection
│   ├── (main)/                   # Main layout with bottom nav
│   │   ├── home/                 # Discovery feed
│   │   ├── pros/[id]/            # Pro detail page
│   │   ├── businesses/[id]/      # Business detail page
│   │   ├── match/                # Multi-request flow
│   │   ├── chat/                 # Chat list + rooms
│   │   ├── schedule/             # Booking calendar (for pros)
│   │   └── my/                   # My page
│   ├── (pro)/pro-setup/          # Multi-step pro profile setup
│   └── (admin)/admin/            # Admin panel (role-gated)
├── /components
│   ├── ui/                       # Design system
│   ├── chat/                     # Chat components
│   ├── pro/                      # Pro profile components
│   └── matching/                 # Match request flow
├── /lib
│   ├── api/                      # API client (axios)
│   ├── hooks/                    # React Query hooks
│   └── socket/                   # WebSocket (Socket.IO client)
└── /store                        # Zustand global state
```

### 6.3 Real-Time (Chat) Architecture

```
Client (WebSocket) ←→ Socket.IO Server ←→ Redis Pub/Sub
                                               │
                                         Bull Queue
                                         (async tasks)
                                               │
                                         PostgreSQL
                                         (persist messages)
```

WebSocket events:
- `message:new` — new message in room
- `message:edit` — message edited
- `message:delete` — message deleted
- `message:reaction` — emoji reaction
- `message:read` — read receipt
- `room:unread_count` — badge update
- `notification:new` — in-app notification
- `typing:start` / `typing:stop`

### 6.4 Scheduled Jobs (Cron)

| Job | Schedule | Description |
|---|---|---|
| `pudding_rank_reset` | `0 0 * * *` (midnight KST) | Calculate ranks; reset top 3 to 0 |
| `match_request_expire` | `*/30 * * * *` | Expire old open requests |
| `media_cleanup` | `0 3 * * *` | Delete chat media after 20 days |
| `escrow_release` | `0 10 * * *` | Auto-release escrow 3 days post-event |
| `review_prompt` | `0 12 * * *` | Notify users to review after event day |
| `settlement_process` | `0 9 * * 1` | Weekly settlement batch |
| `quote_expire` | `*/15 * * * *` | Expire quotes past valid_until |
| `point_expire` | `0 0 * * *` | Expire unused points |

### 6.5 Image Processing Pipeline

```
Upload Request
    │
    ▼
API receives multipart/form-data
    │
    ▼
Face Detection (AWS Rekognition)
    ├── No face detected → reject (400)
    └── Face detected → continue
    │
    ▼
Image Crop/Adjust (Sharp.js)
    │
    ▼
Convert to WebP (Sharp.js)
    │
    ▼
Upload to S3 (original + processed)
    │
    ▼
Return CDN URL to client
```

### 6.6 AI Message Generation (Multi-Request)

```
User fills form:
  - category, event_category
  - date, time, location
  - budget range
  - selected styles (multi)
  - selected personalities (multi)
  - custom notes
    │
    ▼
POST /match/requests
    │
    ▼
Server calls Claude API
  System: "You are a Korean event booking assistant..."
  User: [structured form data]
    │
    ▼
Claude returns polished Korean request message
    │
    ▼
Store as ai_generated_message
Deliver to matched pros via match_deliveries
```

---

## 7. Core Workflows

### 7.1 Pro User Onboarding Flow

```
1. General user → "Become a Pro" CTA
2. POST /pro/profile (creates draft)
3. Step-by-step form:
   a. Terms agreement → POST /auth/terms
   b. Referral code (optional) → validates referral_code
   c. Basic info (name, phone, gender)
   d. Category + event categories selection
   e. Region selection
   f. Image upload (min 4, face detection)
   g. Short intro, experience, career years
   h. Awards, company experience, languages
   i. Detail HTML (Naver Smart Editor)
   j. YouTube link
   k. Services (at least 1 recommended)
   l. FAQ entries
4. POST /pro/profile/draft (save progress any time)
5. POST /pro/profile/submit
6. Admin reviews → PUT /admin/pro-applications/:id
7. User notified → profile live (pudding rank assigned = 0)
```

### 7.2 Multi-Match Request Flow

```
1. User → "Request a Pro" CTA
2. Select pro category (e.g., MC)
3. Select event category (e.g., Wedding)
4. Input event details (date, time, location, budget)
5. Select style options + personality traits
6. (Optional) custom notes
7. POST /match/requests → server:
   a. Calls Claude to generate request message
   b. Creates match_request record
   c. Queries pro_profiles WHERE:
      - category matches
      - event_category matches
      - region matches event location
      - status = 'approved'
      - NOT manually blocked on event date
   d. Creates match_delivery for each matched pro
   e. Sends push notification to matched pros
8. Pro receives notification → views in /pro/inquiries
9. Pro replies → PUT /pro/inquiries/:id/reply → +2 pudding
10. User sees replies → chat opens
11. Quote may be exchanged
12. Payment made → +10 pudding (successful match)
```

### 7.3 Payment & Escrow Flow

```
User accepts quote
    │
POST /payments/initiate
    │
    ▼
Server creates payment record (status=pending)
Returns PG payment URL (Toss Payments)
    │
    ▼
User completes PG payment
    │
POST /webhooks/toss  ←── PG server callback
    │
    ▼
Server validates signature
Updates payment (status=escrowed)
Updates quotation (status=paid)
Creates pro_schedule entry (status=booked)
Sends notifications (user + pro)
    │
    ▼
Event date arrives (cron job or manual confirm)
    │
    ▼
3 days after event:
  AUTO: payment status → settled
  Sends review prompt to user
  Triggers pudding +10 for pro (successful_match)
    │
    ▼
Review submitted → pudding +8 (if avg_rating = 5.0)
    │
    ▼
Weekly settlement: batch payment to pro bank account
```

### 7.4 Pudding Daily Reset Flow

```
Cron: 0 0 * * * (midnight KST)

Step 1: Read pudding_rankings for previous day
  → Find rank 1, 2, 3 pro_profile_ids

Step 2: For each top-3 pro:
  INSERT pudding_transactions (type=reset, amount=-(current_balance))
  UPDATE pro_profiles SET pudding_count = 0

Step 3: For all pros:
  ORDER BY pudding_count DESC
  Assign rank (1-indexed, ties share rank)
  INSERT pudding_rankings (rank_date=today, rank, pudding_count)
  UPDATE pro_profiles SET pudding_rank = rank

Step 4: Update discovery sort order (Redis sorted set)
```

### 7.5 Post-Event Review Flow

```
Day after event_date:
  Cron triggers review_prompt notification
  User opens app → sees "Review [Pro Name]" CTA

User submits review:
  POST /reviews
  Validates: payment.status = 'settled' (or 'escrowed')
  Validates: no existing review for this payment
  Stores 6 rating dimensions
  Computes avg_rating
  Updates pro_profiles.avg_rating (recalculate)
  Updates pro_profiles.review_count

If avg_rating = 5.0:
  INSERT pudding_transactions (reason=perfect_review, amount=+8)
  UPDATE pro_profiles.pudding_count += 8
```

---

## 8. Pudding (Ranking Currency) System

### 8.1 Earning Rules Summary

| Event | Pudding | Trigger |
|---|---|---|
| Reply to single inquiry | +3 | `match_deliveries.status = 'replied'` (type=single) |
| Reply to multi-request | +2 | `match_deliveries.status = 'replied'` (type=multi) |
| Successful match (payment completed) | +10 | `payments.status = 'escrowed'` |
| Perfect review (avg 5.0) | +8 | `reviews.avg_rating = 5.0` |
| Info registered by closer | +3 | Admin-triggered |
| Referred user joins (pro conversion) | +8 | Referred user completes pro profile |

### 8.2 Reset Logic

- Every day at 00:00 KST, ranking is computed
- Previous day's rank 1, 2, 3 → pudding reset to 0
- All others retain their pudding count
- New ranking assigned to everyone based on current count
- Profiles sorted by rank in discovery feed

### 8.3 Display in Discovery

```sql
SELECT *
FROM pro_profiles
WHERE status = 'approved'
  AND (category filter)
  AND (region filter)
ORDER BY pudding_rank ASC, created_at DESC
LIMIT 20 OFFSET :offset
```

---

## 9. Chat System Design

### 9.1 Message Delivery Flow

```
Client A sends message
    │
    ▼ Socket.IO event: 'message:send'
Server receives
    │
    ├── Persist to PostgreSQL (messages table)
    ├── Update chat_rooms.last_message_id, last_message_at
    ├── Increment chat_room_members.unread_count for other user
    ├── Publish to Redis channel: `room:{room_id}`
    │
    └── Redis Pub/Sub broadcast
              │
              ▼
    All socket servers subscribed to `room:{room_id}`
    emit to connected clients in room
              │
              ▼
    Client B receives 'message:new' event
    Client B emits 'message:read' if room is open
```

### 9.2 Unread Count Logic

- Increment `unread_count` in `chat_room_members` when message arrives
- Reset to 0 when user opens room (POST /chat/rooms/:id/read)
- Total unread badge = SUM of all room unread_counts for user
- Stored in Redis for real-time badge updates

### 9.3 Media Auto-Delete

```
On media message insert:
  SET media_expires_at = created_at + INTERVAL '20 days'

Cron daily:
  SELECT id, metadata->>'url' as url
  FROM messages
  WHERE type IN ('image','file')
    AND media_expires_at < NOW()
    AND is_deleted = false

  For each:
    DELETE file from S3
    UPDATE messages SET
      metadata = metadata - 'url' || '{"expired": true}',
      is_deleted = true
```

### 9.4 Chat Search

```
GET /chat/rooms?search=keyword&from_date=2024-01-01&to_date=2024-12-31

Server:
  1. Search messages WHERE room belongs to user
     AND content ILIKE '%keyword%'
     AND created_at BETWEEN from_date AND to_date
  2. Group by room_id, return matching rooms with preview
  3. For better performance: use Elasticsearch index on messages.content
```

---

## 10. Quotation & Payment Flow

### 10.1 Quote Lifecycle

```
PENDING → ACCEPTED → PAID → (after event) SETTLED
    │           │        │
    ▼           ▼        ▼
CANCELLED   CANCELLED  REFUNDED
EXPIRED
```

### 10.2 Quotation Rules

- Minimum amount: 300,000 KRW
- Pro can edit quote while status = PENDING
- Pro can withdraw while status = PENDING
- User must accept before payment
- Valid_until can be set (optional expiry)
- One quote per chat room active at a time (or per match_delivery)

### 10.3 Refund Policy (configurable by admin)

| Time to event | Refund % |
|---|---|
| > 7 days | 100% |
| 3-7 days | 50% |
| < 3 days | 0% |

(Stored as configurable rules in a `refund_policies` table)

---

## 11. Notification System

### 11.1 Notification Types & Triggers

| Type | Trigger | Channel |
|---|---|---|
| New message | `message:new` in chat | Push + In-app |
| New inquiry | Match request delivered | Push + In-app |
| Quote received | `quotations.status = pending` | Push + In-app |
| Payment completed | `payments.status = escrowed` | Push + In-app + SMS |
| Event tomorrow | Cron: event_date - 1 day | Push + In-app |
| Review prompt | Cron: event_date + 1 day | Push + In-app |
| Pro approved | Admin approves profile | Push + In-app + Email |
| Pudding earned | Pudding transaction | In-app |
| System alert | Admin broadcast | Push + In-app |

### 11.2 Push Notification Flow

```
Event occurs in server
    │
    ▼
INSERT notifications (user_id, type, title, body, data)
    │
    ▼
Check notification_settings for user
    │
    ├── Push enabled? → Queue push job (Bull)
    │                    Worker: FCM sendMulticast
    │                    → Update sent_push = true
    │
    └── In-app: delivered via Socket.IO 'notification:new'
```

---

## 12. Admin Panel Specification

### 12.1 Dashboard

- Active users (DAU/MAU)
- New registrations (General / Pro / Business)
- Pending approvals count
- Revenue (today, MTD, YTD)
- Total settlements pending
- Active match requests
- Open reports

### 12.2 User Management

- Search by name, email, phone
- Filter by role, status, date
- View full profile
- Ban/unban with reason
- Grant/deduct points
- Force-logout (invalidate sessions)

### 12.3 Pro Approval Workflow

```
List: GET /admin/pro-applications?status=pending
  Shows: name, category, submitted_at, image count

Detail view: all profile fields, images, submitted docs

Actions:
  APPROVE → pro_profiles.status = 'approved'
             → User notified
             → pudding_rank assigned
  REJECT  → pro_profiles.status = 'rejected'
             → rejection_reason stored
             → User notified with reason
```

### 12.4 Category Management (CRUD)

All reference data manageable via admin:
- Categories (pro + business types)
- Event categories (per pro category)
- Style options (per category)
- Personality options
- Company experience list
- Regions

### 12.5 Pudding Control

- View real-time ranking table
- Manually grant/deduct pudding with reason
- Trigger daily reset manually (for testing)
- View full transaction history per pro

### 12.6 Review Moderation

- List all reviews (filter by rating, date, visibility)
- Hide/unhide reviews
- Create reviews on behalf of users (admin_created = true)
- View and resolve review reports

### 12.7 Settlement Processing

```
Weekly batch view:
  - Pros with pending settlement amounts
  - Verify bank account info
  - Bulk approve → trigger bank transfer API
  - Mark as completed with transfer reference
```

---

## 13. Third-party Integrations

| Service | Purpose | API |
|---|---|---|
| Kakao | Social login | Kakao SDK OAuth 2.0 |
| Google | Social login | Google OAuth 2.0 |
| Apple | Social login | Sign in with Apple |
| Naver | Social login | Naver OAuth |
| NICE | Business registration verification | NICE API v2 |
| Naver Address | Address search & geocoding | Naver Geocoding API |
| Naver Smart Editor | HTML editor for profiles | Smart Editor 3 |
| AWS Rekognition | Face detection in profile images | DetectFaces API |
| AWS S3 | Media storage | S3 SDK |
| CloudFront | CDN for images/videos | |
| Toss Payments | Payment processing, escrow | Toss Payments API |
| KakaoPay | Alternative payment | KakaoPay API |
| NaverPay | Alternative payment | NaverPay API |
| FCM | Android + Web push | Firebase Admin SDK |
| APNs | iOS push | Apple Push via FCM |
| Claude API | AI message generation | Anthropic API |
| Elasticsearch | Chat + pro search | Elasticsearch REST |
| Redis | Cache, sessions, pub/sub | ioredis |

---

## 14. Scalability Considerations

### 14.1 Database

| Strategy | Details |
|---|---|
| Read replicas | Route GET queries to replica, writes to primary |
| Connection pooling | PgBouncer in transaction mode |
| Partitioning | `messages` partitioned by `created_at` (monthly), `notifications` by `created_at` |
| Archiving | Messages older than 1 year → archive table |
| Indexing | Composite indexes on (room_id, created_at), (user_id, type, created_at), (pro_profile_id, pudding_rank) |
| JSONB columns | Use GIN indexes on `messages.metadata`, `match_requests.raw_user_input` |

### 14.2 Caching Strategy

| Data | Cache | TTL |
|---|---|---|
| Pro profile detail | Redis | 5 min |
| Discovery list (paginated) | Redis | 1 min |
| Reference data (categories, regions) | Redis | 1 hour |
| User session | Redis | 7 days |
| Unread counts | Redis sorted set | Real-time |
| Pudding rankings | Redis sorted set | Updated by cron |

### 14.3 Media Handling

- All uploads → processed in background worker (Bull job)
- Images served via CDN (CloudFront)
- WebP conversion reduces bandwidth ~30%
- Videos transcoded to HLS for adaptive streaming
- Business videos: max 10MB, autoplay in list uses poster frame
- Chat media: auto-deleted after 20 days (S3 lifecycle policy + DB flag)

### 14.4 Chat Scaling

| Concern | Solution |
|---|---|
| Multi-server WebSocket | Redis Pub/Sub adapter for Socket.IO |
| Message throughput | Bull queue for async persistence |
| Chat search at scale | Elasticsearch with message index |
| Room membership | Cached in Redis hash per room |
| Unread counts | Redis atomic INCR / SET |

### 14.5 Search & Discovery

```
Pro search powered by Elasticsearch:
  Index: pros
  Fields:
    - name (text, analyzed)
    - short_intro (text)
    - awards (text)
    - category_names (keyword)
    - region_names (keyword)
    - avg_rating (float)
    - pudding_rank (integer)
    - review_count (integer)

  Query:
    bool:
      filter:
        - term: { status: 'approved' }
        - terms: { category_names: [...] }
        - terms: { region_names: [...] }
      should:
        - match: { name, short_intro }
  sort:
    - { pudding_rank: asc }
    - { avg_rating: desc }
```

### 14.6 Horizontal Scaling

```
API Servers:       Auto-scaling group (min 2, max 20)
                   Scale on CPU > 70% or request latency > 300ms

Socket Servers:    Separate cluster (min 2, max 10)
                   Sticky sessions for WebSocket
                   Redis Pub/Sub for cross-node delivery

Worker Servers:    Bull queue workers (min 2, max 10)
                   Scale on queue depth

Database:          PostgreSQL primary (RDS) + 2 read replicas
                   Aurora Serverless v2 for auto-scaling option

Redis:             ElastiCache Redis Cluster (3 shards)

Search:            Elasticsearch (3-node cluster, 1 replica per index)
```

### 14.7 Bubble.io Adaptation Notes

If deploying on Bubble.io, the following adjustments apply:

| Feature | Native Bubble | External Plugin / API |
|---|---|---|
| Real-time chat | Bubble Realtime | Use external WebSocket API plugin |
| Image WebP + face detect | Not native | Call external API workflow via Backend Workflow |
| HTML editor (Naver Smart) | HTML element | Embed iframe or use Quill Editor plugin |
| AI message gen | Call API plugin | Anthropic API via Backend Workflow |
| Cron/scheduled jobs | Recurring workflows | Bubble Scheduler (limited) or external Cron |
| Full-text search | Constrained list | Algolia plugin or dedicated search API |
| File conversion | Not native | AWS Lambda via API connector |
| PG payment | API connector | Toss Payments JS + API connector |
| Pudding rank sort | DB query | Precompute rank field, sort by it |
| Push notifications | Bubble native | OneSignal plugin or FCM direct |
| Socket.IO | Not available | Use Pusher plugin or Ably plugin |

---

## Appendix A: Pudding Earning Code Logic

```typescript
async function awardPudding(
  proProfileId: string,
  reason: PuddingReason,
  referenceId: string
): Promise<void> {
  const amounts: Record<PuddingReason, number> = {
    quote_reply_single: 3,
    quote_reply_multi: 2,
    successful_match: 10,
    perfect_review: 8,
    info_registered: 3,
    referral_joined: 8,
  };

  const amount = amounts[reason];

  await db.transaction(async (trx) => {
    const pro = await trx('pro_profiles')
      .where({ id: proProfileId })
      .increment('pudding_count', amount)
      .returning(['pudding_count']);

    await trx('pudding_transactions').insert({
      id: uuid(),
      pro_profile_id: proProfileId,
      type: 'earn',
      amount,
      reason,
      reference_id: referenceId,
      balance_after: pro[0].pudding_count,
      created_at: new Date(),
    });
  });
}
```

---

## Appendix B: Daily Pudding Reset Job

```typescript
async function dailyPuddingReset(): Promise<void> {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Find top 3 from yesterday
  const topThree = await db('pudding_rankings')
    .where({ rank_date: yesterday })
    .whereIn('rank', [1, 2, 3])
    .select('pro_profile_id', 'pudding_count');

  // Reset top 3 pudding to 0
  for (const pro of topThree) {
    await db.transaction(async (trx) => {
      await trx('pro_profiles')
        .where({ id: pro.pro_profile_id })
        .update({ pudding_count: 0 });

      await trx('pudding_transactions').insert({
        pro_profile_id: pro.pro_profile_id,
        type: 'reset',
        amount: -pro.pudding_count,
        balance_after: 0,
        note: 'Daily top-3 reset',
        created_at: new Date(),
      });
    });
  }

  // Recalculate rankings for all approved pros
  const allPros = await db('pro_profiles')
    .where({ status: 'approved' })
    .orderBy('pudding_count', 'desc')
    .select('id', 'pudding_count');

  const today = format(new Date(), 'yyyy-MM-dd');
  let rank = 1;
  const rankInserts = [];

  for (let i = 0; i < allPros.length; i++) {
    if (i > 0 && allPros[i].pudding_count < allPros[i - 1].pudding_count) {
      rank = i + 1;
    }
    rankInserts.push({
      pro_profile_id: allPros[i].id,
      rank_date: today,
      rank,
      pudding_count: allPros[i].pudding_count,
    });
  }

  await db('pudding_rankings').insert(rankInserts);
  await db('pro_profiles')
    .whereIn('id', allPros.map((p) => p.id))
    .update({ pudding_rank: db.raw('...') }); // batch update with CASE WHEN

  // Refresh Redis sorted set for discovery
  await redis.del('pro:discovery:rank');
  for (const r of rankInserts) {
    await redis.zadd('pro:discovery:rank', r.rank, r.pro_profile_id);
  }
}
```

---

## Appendix C: Environment Variables

```env
# App
NODE_ENV=production
PORT=3000
APP_URL=https://prettyful.co.kr

# Database
DATABASE_URL=postgresql://...
DATABASE_REPLICA_URL=postgresql://...
REDIS_URL=redis://...
ELASTICSEARCH_URL=https://...

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Social Auth
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
S3_BUCKET=prettyful-media
CLOUDFRONT_DOMAIN=cdn.prettyful.co.kr

# AI
ANTHROPIC_API_KEY=...

# Face Detection
AWS_REKOGNITION_REGION=ap-northeast-2

# Payments
TOSS_CLIENT_KEY=...
TOSS_SECRET_KEY=...
TOSS_WEBHOOK_SECRET=...
KAKAOPAY_CID=...
KAKAOPAY_KEY=...

# External APIs
NICE_API_KEY=...
NAVER_MAP_CLIENT_ID=...
NAVER_MAP_CLIENT_SECRET=...

# Push
FCM_PROJECT_ID=...
FCM_PRIVATE_KEY=...
FCM_CLIENT_EMAIL=...

# Communication
SMS_API_KEY=...  # e.g., NHN Cloud
EMAIL_API_KEY=...  # e.g., SendGrid

# Platform
PLATFORM_FEE_RATE=0.15  # 15%
PUDDING_RESET_HOUR=0    # midnight KST
MEDIA_EXPIRY_DAYS=20
ESCROW_RELEASE_DAYS=3
MIN_QUOTE_AMOUNT=300000
```

---

*Document version: 1.0 | Created: 2026-03-25 | Platform: Prettyful*
