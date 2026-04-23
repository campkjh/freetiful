'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Plus, X, Image as ImageIcon, CheckCircle, Check } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import toast from 'react-hot-toast';
import { prosApi } from '@/lib/api/pros.api';

const COMPANY_LOGOS: string[] = [
  '/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg',
  '/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg',
  '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg',
  '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg',
  '/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg',
  '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg',
  '/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg',
  '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg',
  '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg',
  '/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg',
  '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg',
  '/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg',
  '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg',
  '/images/company-logos/SRrqBgHlAil9jg2n7I4SZkLRwUcDf3bN51-iBsr1XI6-4a52MvSjP0EHo3CZVsDIXLkpG2FF-yj5P50n6D37IdfQdt-VN7OqAuH4QnmjXnD76Tomw6YDwsCJzUz29pBTReqT3XzKyXDg1V7bUd7ESQ.svg',
  '/images/company-logos/U4btAF6fKzlMyx9V0YciDz02RYAMbqpypTkUZjxYxE2LTOl9GYED7b76bOg8IXDfq16Er1Lc9ugCJpjWkovcWHgVfqHBd_TvxltZBFYmSSV1m8QMnkoIHR6Tywr3rwxBl48dWmnpOcgI9H9TeSFsow.svg',
  '/images/company-logos/W-Vzx_gdMaygn9LC-dNJuYIwz1dmiuk3LQMq9Pz692djzQ4OJeChfUYwkz393ioiyF0PUoh3aLTsw9qUs3hye41a8pueOhabVVgQxgrqfzN3uWlb6dIlJRracrtHx89cSXymXSF7gFOLl5BYrPXHcQ.svg',
  '/images/company-logos/WSvPMQh9MwaVyaaVkcJPXPAiHlt12lq_eWCs90KgbdOR6eMxcx2pcunmCoAYdAdKZfWiYd5v0k14ipyy2pulf9Eyks272dwhRCaso4mg63ZPh37yiQdgMnJGR-31GGXLA-zITyEy5h5LnReY7bc1zA.svg',
  '/images/company-logos/X_a20hnOPysVQ2Ybud5BiG9JsePpQUlAgZ7I7k75OlqQ8Jjbds4mEYR6MtxSN6BiigG6NX7zzA8FHq65y0En9A.svg',
  '/images/company-logos/Y2LNYrBudEa_mY0hs5l96vum89cGWqz6VURoh1IE9aw_IEhYDrXz6b0O06n5DLk-pt7_jWtOlsCTmoYb0PSN1kBJxv5LngLUpuC38B-CzvqNXaNJbkXxdlyswVkxGKHa2lZrq_7ciWKJCel_ddn_Fw.svg',
  '/images/company-logos/bTM6JHPFAd0TpQVfLybhadM48U9brNK0kr0RZPccZbU-8ZydayEHX19VoisuMNT4RXwlW4ReYpecuv-WALAmfUTxMg2UAA-dMPbuI4AExhpEY7ZgdiGAABBuc2VUpzXun8FdUeGryg7k6OJTfeaVLw.svg',
  '/images/company-logos/bzyX-bcOszBIyZp4I9fXQHBFCFJlDtVZ5NAQb3ipvPR8xehdx99F-xWHDTsVUbM8pEujQv1TQTTrXD7A3Xaaba9t-GOg2yNCBMg7hOg0SIPDGyOWqaSUu3VEY17h1JzvHNtpDPWW7Hs7aA6kUQ0MQw.svg',
  '/images/company-logos/ezX7tL2KZPta0ZvP1Lkh_OEXPbdgEfRygo9kCyM6vcb8JBEagUiFXb22DZl_vszRJjZO9skUXjyliiatyZDDrIrbcTzCCTYenibs7LacOErXMCZq_3C3GA6psClsFYu2Q9T_ioSus-WY3ie67qYG5w.svg',
  '/images/company-logos/fSD1BTd2CtrHz6EOr23a-JtJf_xlusDFuqwHTrrG_Ana3MZO0gD6Z0RxLLG56Wu26d5_eUAtRN71BnavVSNjVhvWQfUYxxFP6SpORqui38vEkw0pEBy9D8sPMnvKROtnKcz9JY7E4R13G-5-whvCvA.svg',
  '/images/company-logos/gQQBEDoS4V9wEzN-pj8dTe3V90azRcnv9wEVO3sxVQ76hOji4FinhMT-BZExwiOFhthnYBwEZR98A1ledzfgGQuHMloSpNtMAJ2aEvwhvlB_gwIIfpE08qtHptw_EznuI4YicbPYt708m7jGGsrO0Q.svg',
  '/images/company-logos/hVgF57hJ3xB0lWARAqgbKzF11iF_jHKPcy54Eatniz_PFt7nn-VH2zQRz93Lrzr14E07XvB2NeeHPH9_Tlxe75PO0-Sm1eByKRVeSEh9CAz-vzvDx1S69XMAP8d5YC_8skzq_6gt2qzVNxtS0F_bxA.svg',
  '/images/company-logos/lJaLPyiCksy4rKDEV86j9XqTd1QnIaiSPRZseWCttzMNixmZoBoggD7_wObo5aWy-30Xq22vNOgK7iwlobpvnO_PQIhrntTuBobFXVSjz9whoeU1IBExjolEGGdMydMmqKS6urghRnD2XACePGbp0A.svg',
  '/images/company-logos/mrnlNZzBeFxCorw5B0VjguNwYyRwYOZeMdp_UjoG5y7mbvBrkiv7hm0F8fiFsuUuyo8B83Uqv1Gz-v5Oe0FvoWZcBLoKuuZ88v9TkwFFzEGmApWGQiCCCCpR8ykp5nOGhOpYHt7tiAAyDFiy8_GknQ.svg',
  '/images/company-logos/n8d4p6AMfV8YVZiX5mst1veEfo9S7-y2GSe9ar-wGOEIa7y9w2mHQGm-a7w4BKzArAwN-Mhhv_jkfZfh1gc4aQ.svg',
  '/images/company-logos/nzX7hfiNDhzsZ5CC1dEpPbS84Ic2VNMBA4KAv-MfUcyYAlE_xhBUMhNq35nxuu-spWifKWjVzP_Q1jBbUAL4faNd2JlExARVqQeJkhOFGYJy0ZzAMkDFYqT83_MiQS5Rj1bRHdE8I2yVdtpeQYYwAg.svg',
  '/images/company-logos/oGx8Lf-pK-fz_NQBIQ6z0pJB386NEHT88b0IbG-WIuBmV5uzV1Ryi958B1bU0C0djwVNOZ-J7McjnTTz5EiVajLJz9Vfp2_vc6sFQ_gWgzzh8vRe6Mk1SNiAwRtcP-L-uE8bkMOeK5DE0JRd-O3aRA.svg',
  '/images/company-logos/p-10BFRQN-_hRreerH2X6Y1rzrcspaEiODZ0m9n3VonlNG_3KoJbQQo_i_aIEr56siCqXNmeOcfLSReRQsdB0w.svg',
  '/images/company-logos/tURiQcsQ4gqf5yehCIeBxoqAPAp8kbvJCFHt3pnJy5cf2d27mEVfyAwQtWdTT1aJP1wjS_dJlZzdGEk7P9fcrHezTDlrqqIb-ZQnXIkOgcp-S37Yit2UBGVMPyf6eUae605-0LzI5GdO3wQ0GRxRjg.svg',
  '/images/company-logos/uDLH9KAZCQMK2nqJyLEVJ9UzXnKO7uVJYZ4mgZMRS7m8wy6u7X2et3QHKDwYKNdhKoqjDWdMrhzpPpC9H1_L8Q-KOZwPbdcd3WdTSgJs-6g5N0zlZj3D-hgnY0s-VcAcLRTR1zgAwbD_bByywC802Q.svg',
  '/images/company-logos/y1AlwExMBWcxyTKygmw8EVoS0g_9Y_pLgbPEhUkc25b_h-4yTyiaVLSkVL0HjhFbX6cyQML4Uvk2LQYndy2Cs8Cys7FcUr8PqXwh9fRC0h8GtKB8nCZwaSWx3AFt-TdtPpWzytnx9w6owHJcAjeFEQ.svg',
  '/images/company-logos/ywnQTrlMBh8nsZsYJ-5WCT1d26iSqwxByWYPRIUtq4s2vJKvt_U1BxswLhWhvPg1txioQ7jtlSQ020q6ox0FVPVb8QXxK6rRYUO1mPoU9jEDg2qqGJoES4flW6d3opZKTcO7T1214OlUS6ch_RCUBA.svg',
  '/images/company-logos/zO55rSFFBt8SWtnaLX8pZ4KB6WlImBmSYRCCEAteo5NEAPrOKqtDmSGRDk2EXZUmiyPhdFCOKnkaCZ2BstnHa-h_Xz49IZDf1_R7H4gVSBEzRF4gZkgC6riVGwIDJnBd_Y7JbT_454w-PswxOT1OVw.svg',
  // 신규 로고
  '/images/new-pros/0Z2a5Dm73dV3bpSYziB_ZbPe6vAXvU_NQ7SHm6rggzZzORZMmJ-Bdd9P7DY4autyTJfD70J0DZeXIh3-vAOGXzJ9tHXudeB-H30r16a00kAEPEuxI0d-NLmTYuZHa3GZRhvkMyb5kV1-_w-bA1U-dQ.svg',
  '/images/new-pros/16ye9skDt79d8WSrqt4yCko1gdeQkatF2lTqrMpp3kFx19fZ1yXZDDtIEk-DFBF2qFanYllH-XIA45Fb-OzgvCdMGjC4pLtgUp6lLRXjTCESYHiJqOL3ahwQ9fD7VwWPBLfpV5FP8_7ch14wm-LQCA.svg',
  '/images/new-pros/3ZFfvRIoEqqSt07_Y6fD69lgLx_R1x7Fhwrih5m7JYJU1Daj-Ne_DGMMSiYFjhGEE7MpWSHPfrXSDj3S7-koXtVgQJiEtbYjs_W0aSAc_xESmwAIZr6gvLe-e-yEWwFBqW00ODU7bDLo3lXubsGJCg.svg',
  '/images/new-pros/5c32ImCVecQo6lQB2C8lVaWMLkqeVpLftIAO5cdGhRkTPZnsI_B06TUQqtfw7EE-btWTb88FlaRQxzbgtu3lGcLfq6OVsVHuVYkxmoSOlju0rDlR_ZYoc2mgtPTGgAtT3eMPtnNpZHnF7a7RfNSIgA.svg',
  '/images/new-pros/5yjzAHAHlIRqDQmGmtCp9zXgMFUwV70EoqkXOka2iQ6fbH2gr-CXkJwk8nYBwcu71b6F9PXfjRq1P0vz20Mt_A.svg',
  '/images/new-pros/7ZhDXaEabXtd3OHs-6ET7qco1YbDLhntaZPn05EOOsnhj-iMHG47OBNAFlzwsXhpPAQXKYxa5hbh6qOKutiT_g.svg',
  '/images/new-pros/CXa5ZnW0wLr0UnP6hE8JyU-IK0lfdWlo-2fY0PEOtI8SuXx-GSkkw9G0NjpaPmDZmKP1xPvd7YFMpzPiy_8qIlluAfYbgdPqRzsgrM8lRbN3SbtMnB4SThvT1SeaDdf4PbPv70GWwlfRgYgJTNy_wg.svg',
  '/images/new-pros/DGy85kyuHf2k5zPgFLqqmy_KxzG529WgecGTIodoMex85DQl6F8gXCjp9uesebxo2EaxEKiDV6ZI_5AHUabxBs7ZxT7_1kHq6uir5KfsR0YpHK1fGp_EVZmMxuuEnSQPJmQfJ_8tfe50HP2Urp70CA.svg',
  '/images/new-pros/FTgpnEJleG2-4KcxBMJRJhwmJOar7Uh16vJehoBWoSxevVKthGe7nb8-Mh-ELXfAm9jj2bURVz3D2GbUEnZk75EFHeaATfkixZq6v43AyEfR5tzAiKKmotQJhPSYffoE0lGnJm2-UI7tXah1FSt74Q.svg',
  '/images/new-pros/Fc4B1y9xJ0rbXi6qFOTh_t2eatK2RTadmVYZ5oM3QzBHGo-GCM5H1rxrQc3XF6PwKVO2be72OwZrNEENvVi-Lg.svg',
  '/images/new-pros/KuqDoLxQK0jaEPQFZvgDeWgDdBZ6o1LKWj12RjglN4uL_1X-MZVHMnd-bjvBuPVwmq-V74SzYzKNNPqZnQ9DJiazzDu98DmWbC6Ln5UkpKIj27CF3kUHipP9ewn3YYFaoKD2sw1DwRHVBn4XkUiQnw.svg',
  '/images/new-pros/OmEe-wrGKyixj0DX8bOS80f_5l0ML1wvCL_AZosOHTfQdplKm8-WItqjhKphL21vx1jB6HFmhEOmvEd42l-9xCRpToFGHArdcaMZrOE6Gt3Nw6lwHxL0EQNSmlOtOmJf2wu3xEG24we8wQpLVeM3Qw.webp',
  '/images/new-pros/OvthFfWDhmQ4yQ5eTRRpJTaXOzaEYQ94k3NY7RAzV-brSmwCZ9hwUkZqkSSUgMMa3nUVkIEKkVOIUbHLQtzSf1msXZEVhkpyrBVJz9beAROSyKF8ATIF-4J1z8H1E79cVPFk9H-fY4WNEI6zyMuLIA.svg',
  '/images/new-pros/PfqwLuC1o9317-MqR7Ix2Y5JGbbXK1f56ehBPcHISgtxnpL92-bouLm6pXvAfrm_UGrLfOeNcYWG13pZJQ_p_uyaJLGf1cBWXFKplEuzOgo9JqVdsMJxsb7k8GJTevsmJB7-E1ZvxcHrvRRDRFtQtg.svg',
  '/images/new-pros/RWvJuKMsnG16vIbmfBedtEfRX8SeXYsuu80DcdEQXs40w7gxo_B489JGTX_aQMXfofaVl724YKJDtzIQhCyrRmm997cddF0XnioxiWtBCINb8RYK_KpxdIaN9LvLUiQwnhfNkITqFVykrzx8j5SVHw.svg',
  '/images/new-pros/RyjBzICQOh8fiELA0xbdiUk-O2tUYJonN8uZj21-Kaa976n1c67QLdirf6rWUgxR89LPwElWk1l9xDRc0tGaGSEMCbqJKP0jJ5sN5KPD5qNvsSMfViwnf5eUMLB2QglxH96HNWkWlPb9HpxQ8QNQAA.svg',
  '/images/new-pros/RyzKemTgtL3EQ0wJOfBO8iuOee6qFElcTcGd33p84WnszvbGrD6RbvdefkvV8FHs_V-1OnnBSf0z05ADDrvTNOp6dPZArcwD8wvh_aU8FNdF1utavFUG-iLG3asBt_R9pP1YCc9FvNOXLv3IBbgtBQ.svg',
  '/images/new-pros/Syp0sFpMgGImVSl4V5MFzWAVIuq8p7yL7Vxv-M-qoc_hwXDPceffMGuIA3_RCPcy9a1ZQbV6x921lKOVQ7WWkA.svg',
  '/images/new-pros/W54iBGRLiSdeikdCquOvjEF1kl6OgYJq6R7nY8zc2qH9qrX2pDQxoFmXlhikZoBdntgOa4cmrRzYhlxiUH60tw.svg',
  '/images/new-pros/Zwm9M9Ph03T4KMo7TYRS3dBZDMAUgc_KOYHFufveAeqK76374cFAcmIq6z9vbVY0yYTjs7ZIyFcg2HR2RLZwzay4dCahBEiXRSogMOj1UVpL0_kGdwOpGFISRvrpStn21kbY5lz_pZviHGtrCW7T9g.svg',
  '/images/new-pros/ahJV7JjPyXESBF0Bdj7_0jYs_r9t6bNFW8_V8MnR0mC6z2EEn95QK9dlrRmlA6v1ZoNWAhFdHXdO4-iClVZhLw.svg',
  '/images/new-pros/cp3ZnsP9jbZH_tYwd7pBQNdGy15UFyNI0XTzU7Pw1prvjyr360JdFPNUeBeEmZiyj9Ftr16YsLaPV6_JIyLesa2m_sIwLYsmYvoq15C-HarL_DK4_LKW4qKrZ4LDYDNRJz2jz4iS--HA02SCkaDYWw.svg',
  '/images/new-pros/ctFfzSEtvQxXYkr34AUIIh-wI7TZ_V6pXpMtVMrxwf-zYIg9lt5ApPahIi0BDdJxI6avLU2JRovcdm18Gy57-ge1BJH62zyCSbkd6GfZ8XAek_d-J26Ogt9aTVB4sthXgi58HeuftNcrIEdp57FD0g.webp',
  '/images/new-pros/eJEpQlPWpgyBAhWOs7MzYOvBYt9tGZQ-KyzaGJyIqMiwlq86ODldUZyOFScRIF1C4koIJBciufB7KRdwpXkYB5ZjhalZQeo30fRBnbzux8q261CRztdP6Fq09XdjtzNag9_f5nknqUbO0YYVSMUG8w.svg',
  '/images/new-pros/hEPrLaAGkvjPNaW4D_MA7Q_XZMYJWjvvGS2JD3FbS41BCoZiyga45OoXAzgAvGoxE--YLbbqLsANLKRvtlpyp7Ud2_UtT82YqVt8pzJsv7EgY9lsMGhAp-of8X8KEGfMyr4QjgLqC2aUJf3S07bthg.svg',
  '/images/new-pros/hlTupMIdFDnPlpvuLnonwB8MJQSfkq5sZA3Uq1EYmdnGMNJhrh-XMBh77jQIVVRDygwn8NYTAwg5GhijT2r8pFeT49fY_tgmauy4PsezUl7VxLUs9BM9jI9XTVuSKz9Dw41IHSBw3IBUZ-yuBfFf9g.svg',
  '/images/new-pros/jT7u9WAn_h7dEtZC2CLiB5SgXPNGYWf0yXactbgH4FS7MaiS4rPlHszlYAsB2dQmNd_B_B8_2cfQJkbjITtaVnNkimpV50Hlh4GzzDdEs-jO5MBiYRijckrsmgAa0kRjGFc2NmAPqNF2zV8Aw5kY_g.svg',
  '/images/new-pros/jfU1fvaeWvywZF4gx7CkrOeu4Dvg_3v_IfqlNYP12Hcl0p-XVIorMihaWpd72lVy7XsmJR9kurgRwgeGwCyDXc6gLpyGduSkqspW8EEOGVF4m7xf39OAZjEdMlBEw2YNySVvkqGtrSWs9q75ja4ogg.webp',
  '/images/new-pros/nr-juai2PUut1peocRLli_GQKvYe4NlsxSQVyW4ZzcdQoeuDHHm4Ut1rElHVaxwnFfto0vwAdSdhZn-lKOiT2NAYnFp84r1fvscDoB-T7JzQQ2nJBcWRR1lLWPOIgvI2ja5hFthbb6j5Io5MH9pOfQ.svg',
  '/images/new-pros/o3MpRcpkkkam8IKetJIJda7qZs7EWAlTrcr-AJsRhtU0zq8D-9zQSKqkSV49wz--d8eyGxdKC4vqlz85W2o-oa4GytxImoO705JZEuhA4VHJDhcX4sFG7r_fc5qUqa-z7zWq6Ai8acUOxcOqY3bDyw.svg',
  '/images/new-pros/o8Obm5DPwnRnOmMVPYXrozjU6cnthPd4_5Y_89MVpJqxXya-FkScsSNlJpG5Qhk9ioG4n2Efgd0T58gfBMRP8dUHDPAgOeMRDzFgD3Q5mI__AFQooLs1DagVEginIBPyj8zzVK4NiBLBPjqUB6qQUA.svg',
  '/images/new-pros/qq5lHRZzw_bmDEQjFCKCQljo8Xa55-jPTKavQ8Md9d8nEEhGKrYROtmRhbJtIMdHGHSTTByP09rgr9SZVYKRLCDGhMH2qGPBVbxGzDJGWOJQVQ3bu-zPV6WBZSzOGf64ZY-KWlYYrtQuSgS3--99qw.svg',
  '/images/new-pros/rFbILkDzIgLxoS2x5i8mYo9U0ZPsZuzjz4p_CBnDuJBXeaS4Nyxki7cr1FYBfgRls52oQeTEdy-qpVKITUkZQxllXPAEbeRkd14BQVgSGL1mG2CqMMKlIKuPlI0-_2n_9d2PmJKAJqy-ch2RZVnJ1w.svg',
  '/images/new-pros/shYEnD7H2-NxAglhxieGlKgPNlJcA_PV-V88K5TpZbyAPKgWBEAIE6jDCYhUo9uvTDo1BcijAyNYE66KArL2YrWvy6b3i2L-3EyYgN-qnhjACj0sRo641mbAwxgvM7jy9yS23_rXnQ0IU9ERm--PQA.svg',
  '/images/new-pros/t6SGoWkXyNocZapsADVhFms8XgwGBK2jJxuquyUNwwRlDPrDktmlliU_FmfIdE2tfVJtMazM07zskgCYTkUbdewVLeYgnqRzb_mTb0S2ee4XFrYzYJpCvm_XUbx7NMMXwtUCbKO-p4AFrBErlfGFEg.svg',
  '/images/new-pros/tjlYA_pGaBhy9fEYsRGSRt4JySqoGadBVbAqdeAGTqpY4qoH6tvnW6fAeRrbkvM82WEjmjwkkvqFJ5hQGQ7Gpa0Za4pw7sRoGyX8ubVtMN5AWP16XaGlI4uuQlTIzAcAwnRjeJZGyepK1NVsBHZ_ow.svg',
  '/images/new-pros/u4ka2KrtwrBvAcyO75KKnMblKDeIAgt9L26PSxfUZ3lnlq0FfJKUio-nO-RzajcTTRvO8TGBmJpf5_1Mye0SkkSFlpakXWZ4izCKjF5YEYToS6qq0AWdtxK28198w5T7P0Kd4qu1C9rYFvfHB7tkmA.svg',
  '/images/new-pros/vagS9y81xqIZVkmGADHRto3ETirDLcc1QimJ9WKZ8k6Xxu76QyqBSIKM80iBn9dmc2SNJhtOuoEiBBy7jqKbRfh2YaE4U3AqvsFjUB3yZogwsMQDz1QQBIdqISz46LPxX0wg2oQ8VN0AToQdLCdFRw.svg',
  '/images/new-pros/vrv7O8ykQ592F14_6cQfuwKRz1-6oFdpWrCuiAyYJIVx9pF0dSkdUQrKQWjZDB73kWyuUHa4Scn6YwWsJyTOJ7Gt2xVm_w-IQ0ObknzlLPPJ4dOv9uuBs_i1acDiRmBCQmWRofbF2MjPxi9oxN7PxQ.webp',
  '/images/new-pros/wQrSGoted95B-zFg337mcv6jHUtF7oGFth2nQOApCXHCl7IJ5fAe4UWOQBiqxksKsWvBmKINf0NeFBrPWFq-qDethVP_Kc9Zp-demJPe6X_p09tT-78sTItNR-6t6A-kTjvhxtvofKk7QLk9P18Mmg.svg',
  '/images/new-pros/yA_ucHsj6BVLOsa7WzK7qPwREmQ5ibcCQuIbSrp36h-XkN8_-L04Y0jgJJT-sln7xJmrzPjq3QT_EE5DqOWwVEAjp9wPliedYDg-NeEJYydCTsUnCQ93g2Gnw2dXsI92wgTQAOy_fCRICA25yH3qUA.svg',
  '/images/new-pros/yooLJ_Hd614Qxv-rluwanhBbEyZXEMCUhJbBlo0EmnqGWWOM-v2C91AJIpkzVRoW6V8BHCbnk7yFHeYyqKtn6HtNzFvmm-i_QE29Z0ziFsWUkfCO9j-zz0VYWLZvTs4WUx_qGVzT2S15KkdFi2qMcg.webp',
  '/images/new-pros/zVWpZ2MIFBYG3DwTSeZkr_on3S0MAXpR0eMshzw8o0_LPpgKb52TsDWqXaMKoMfOOT1GrMxSCB4ExAfPvc001g.svg',
  '/images/new-pros/zl53PasQ8QjJCmbQxsrH5KAF337_PWRhGFXCy0CIE8khyMz_nQKdCsGBKjgKjGSjedGY-OE_ld29RXDFRmpUoclzUTFSKCKDgRhk9EFKJvL9jwYO-mmSf58s-gWrCcLoguJ7h6t4WS66BdkQiTMBoA.webp',
];

const LANGUAGES = [
  '영어', '일본어', '중국어', '러시아어',
  '아랍어', '힌디어', '프랑스어',
  '포르투갈어', '터키어이', '스페인어',
  '독일어', '자바어', '베트남어',
  '이탈리아어', '태국어', '광둥어',
  '뱅골어',
];

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const bottomSheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring', damping: 28, stiffness: 300 },
  },
  exit: {
    y: '100%',
    transition: { type: 'spring', damping: 28, stiffness: 300 },
  },
};

export default function ProfilePage() {
  const router = useRouter();
  const [intro, setIntro] = useState('');
  const [careerYears, setCareerYears] = useState('');
  const [awardInput, setAwardInput] = useState('');
  const [awardYear, setAwardYear] = useState('');
  const [awardMonth, setAwardMonth] = useState('');
  const [showAwardYear, setShowAwardYear] = useState(false);
  const [showAwardMonth, setShowAwardMonth] = useState(false);
  const [awardList, setAwardList] = useState<{ text: string; year: string; month: string }[]>([]);
  const [videoError, setVideoError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [videoInput, setVideoInput] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [ytChannelQuery, setYtChannelQuery] = useState('');
  const [ytChannels, setYtChannels] = useState<{ id: string; title: string; thumbnail: string; description: string }[]>([]);
  const [ytVideos, setYtVideos] = useState<{ id: string; title: string; thumbnail: string }[]>([]);
  const [ytSelectedChannel, setYtSelectedChannel] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const FAQ_CATEGORIES = ['서비스정보', '수정 및 재진행', '취소 및 환불 규정', '상품정보 고시'] as const;
  const userName = typeof window !== 'undefined' ? localStorage.getItem('proRegister_name') || '' : '';
  const FAQ_DEFAULTS: Record<string, string> = {
    '서비스정보': '전문 사회자가 행사 당일 현장에서 사회를 진행합니다. 사전 미팅을 통해 행사 진행 순서를 조율하며, 신랑신부님의 요청에 맞춰 맞춤형 진행을 제공합니다.',
    '수정 및 재진행': '행사 진행 대본은 행사 3일 전까지 수정 가능합니다. 행사 당일 현장 상황에 따른 즉석 수정은 무료로 제공됩니다.',
    '취소 및 환불 규정': '행사 7일 전 취소 시 전액 환불, 3일 전 취소 시 50% 환불, 당일 취소 시 환불 불가합니다. 천재지변 등 불가항력적인 사유의 경우 별도 협의합니다.',
    '상품정보 고시': `서비스 제공자: ${userName || '프리티풀 등록 전문 사회자'}\n서비스 형태: 행사 현장 사회 진행\n이용 조건: 사전 예약 필수\n취소/환불 조건: 취소 및 환불 규정 참조`,
  };
  const [faqContents, setFaqContents] = useState<Record<string, string>>({ ...FAQ_DEFAULTS });
  const [activeFaqTab, setActiveFaqTab] = useState<string>('서비스정보');

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCompanySheet, setShowCompanySheet] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleImageInsert = () => {
    imageInputRef.current?.click();
  };

  const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editorRef.current?.focus();
      document.execCommand('insertImage', false, base64);
      setDescription(editorRef.current?.innerHTML || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const [isFormValid, setIsFormValid] = useState(false);
  useEffect(() => {
    setIsFormValid(intro.trim() !== '');
  }, [intro]);

  // ─── AI 상세페이지 자동 생성 ───
  const [aiLoading, setAiLoading] = useState(false);
  const handleAiGenerate = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const { aiApi } = await import('@/lib/api/ai.api');
      // 업로드된 사진 (base64 data URL 만 전달)
      const photosRaw: string[] = (() => {
        try { return JSON.parse(localStorage.getItem('proRegister_photos') || '[]'); }
        catch { return []; }
      })();
      const imageDataUrls = photosRaw.filter((p) => typeof p === 'string' && p.startsWith('data:image/')).slice(0, 4);
      const out = await aiApi.generateProfile({
        name: userName || undefined,
        category: localStorage.getItem('proRegister_category') || '사회자',
        careerYears: careerYears ? parseInt(careerYears) : undefined,
        selectedTags: selectedCategories,
        languages: selectedLanguages,
        awards: awardList.map((a) => a.text).filter(Boolean).join('\n') || undefined,
        keywords: intro || undefined,
        imageDataUrls,
      });
      // 에디터에 상세 HTML 주입 + state 동기화
      if (out.detailHtml) {
        setDescription(out.detailHtml);
        if (editorRef.current) editorRef.current.innerHTML = out.detailHtml;
      }
      // 빈 필드만 채움
      if (!intro && out.shortIntro) setIntro(out.shortIntro);
      // 스크롤하여 에디터로 이동
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

      // 히어로 이미지는 별도 요청 (15-30초 소요) — 텍스트는 이미 반영됨
      try {
        const hero = await aiApi.generateHeroImage({
          name: userName || undefined,
          category: localStorage.getItem('proRegister_category') || '사회자',
          keywords: intro || out.shortIntro,
          imageDataUrls,
        });
        if (hero.url && editorRef.current) {
          const imgTag = `<img src="${hero.url}" alt="${userName || '전문가'} 프로필" style="max-width:100%;height:auto;border-radius:12px;margin-bottom:12px;" />`;
          const currentHtml = editorRef.current.innerHTML;
          editorRef.current.innerHTML = imgTag + currentHtml;
          setDescription(imgTag + currentHtml);
        }
      } catch {
        // 이미지 실패는 텍스트 결과에 영향 없음 — silently skip
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      alert(`AI 생성 실패: ${msg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const careerYearsOptions = Array.from({ length: 30 }, (_, i) => `${i + 1}년`);

  const filteredCompanies = COMPANY_LOGOS;

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const addAward = () => {
    if (awardInput.trim()) {
      setAwardList(prev => [...prev, { text: awardInput.trim(), year: awardYear, month: awardMonth }]);
      setAwardInput('');
      setAwardYear('');
      setAwardMonth('');
    }
  };

  const searchYtChannels = async () => {
    if (!ytChannelQuery.trim()) return;
    setYtLoading(true);
    setYtChannels([]);
    setYtVideos([]);
    setYtSelectedChannel(null);
    try {
      const res = await fetch(`/api/youtube?action=searchChannels&q=${encodeURIComponent(ytChannelQuery)}`);
      const data = await res.json();
      setYtChannels(data.channels || []);
    } catch {} finally { setYtLoading(false); }
  };

  const loadYtVideos = async (channelId: string) => {
    setYtSelectedChannel(channelId);
    setYtLoading(true);
    try {
      const res = await fetch(`/api/youtube?action=channelVideos&channelId=${channelId}`);
      const data = await res.json();
      setYtVideos(data.videos || []);
    } catch {} finally { setYtLoading(false); }
  };

  const selectYtVideo = (videoId: string) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (!videos.includes(url)) {
      setVideos(prev => [...prev, url]);
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const addVideo = () => {
    const id = extractYouTubeId(videoInput.trim());
    if (!id) {
      setVideoError('유효한 유튜브 링크를 입력해주세요');
      return;
    }
    setVideoError('');
    setVideos(prev => [...prev, videoInput.trim()]);
    setVideoInput('');
    setShowVideoInput(false);
  };

  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const updateFaqContent = (category: string, value: string) => {
    setFaqContents(prev => ({ ...prev, [category]: value }));
  };

  return (
    <div className="fixed inset-0 h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-6">
        <motion.button
          onClick={() => router.back()}
          className="mb-4"
          whileTap={{ scale: 0.92 }}
        >
          <ChevronLeft size={24} className="text-gray-900" />
        </motion.button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(7 / 7) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          전문가 프로필 <span className="text-[11px] text-gray-400">7/7</span>
        </motion.h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* [필수]전문가 소개 */}
          <motion.div className="py-4" variants={staggerItem}>
            <p className="text-sm text-gray-500 mb-2">[필수]전문가 소개</p>
            {intro && <label className="text-xs text-[#3180F7] mb-1 block">한줄평소개</label>}
            <input
              type="text"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="자기소개를 작성해주세요."
              className={`w-full pb-2 outline-none text-gray-900 text-[16px] font-semibold placeholder:text-gray-400 ${
                intro ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300'
              } focus:border-b-2 focus:border-[#3180F7]`}
            />
          </motion.div>

          {/* 경력 - horizontal scrollable pills */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">경력</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {careerYearsOptions.map((year) => (
                <motion.button
                  key={year}
                  onClick={() => setCareerYears(year)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    careerYears === year
                      ? 'bg-[#3180F7] text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  whileTap={{ scale: 0.92 }}
                >
                  {year}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* 수상 내역 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-4">수상 내역</p>

            {/* 등록된 수상 내역 */}
            {awardList.length > 0 && (
              <div className="space-y-2.5 mb-4">
                {awardList.map((award, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0"
                  >
                    {/* 날짜 */}
                    {(award.year || award.month) ? (
                      <span className="shrink-0 text-[14px] text-gray-900 font-bold tabular-nums">
                        {award.year}.{award.month?.padStart(2, '0')}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[14px] text-gray-300">—</span>
                    )}
                    {/* 수상명 */}
                    <p className="flex-1 min-w-0 text-[14px] text-gray-600 leading-snug">{award.text}</p>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => setAwardList(prev => prev.filter((_, i) => i !== index))} className="shrink-0">
                      <X size={14} className="text-gray-300" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 입력 영역 — 카드 스타일 */}
            <div className="bg-gray-50 rounded-2xl p-4">
              {/* 연도/월 선택 — 인라인 */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowAwardYear(!showAwardYear); setShowAwardMonth(false); }}
                    className="w-full h-11 px-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between text-[14px] font-medium"
                  >
                    <span className={awardYear ? 'text-gray-900' : 'text-gray-400'}>{awardYear ? `${awardYear}년` : '연도'}</span>
                    <motion.span animate={{ rotate: showAwardYear ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-gray-400" />
                    </motion.span>
                  </motion.button>
                  <AnimatePresence>
                    {showAwardYear && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-12 left-0 right-0 max-h-[180px] overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-xl z-30 scrollbar-hide"
                      >
                        {Array.from({ length: 30 }, (_, i) => `${2026 - i}`).map((y) => (
                          <button
                            key={y}
                            onClick={() => { setAwardYear(y); setShowAwardYear(false); }}
                            className={`w-full px-4 py-2.5 text-left text-[14px] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                              awardYear === y ? 'bg-[#3180F7] text-white font-bold' : 'text-gray-700 hover:bg-blue-50'
                            }`}
                          >
                            {y}년
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative w-[90px]">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowAwardMonth(!showAwardMonth); setShowAwardYear(false); }}
                    className="w-full h-11 px-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between text-[14px] font-medium"
                  >
                    <span className={awardMonth ? 'text-gray-900' : 'text-gray-400'}>{awardMonth ? `${awardMonth}월` : '월'}</span>
                    <motion.span animate={{ rotate: showAwardMonth ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-gray-400" />
                    </motion.span>
                  </motion.button>
                  <AnimatePresence>
                    {showAwardMonth && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-12 left-0 right-0 max-h-[180px] overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-xl z-30 scrollbar-hide"
                      >
                        {Array.from({ length: 12 }, (_, i) => `${i + 1}`).map((m) => (
                          <button
                            key={m}
                            onClick={() => { setAwardMonth(m); setShowAwardMonth(false); }}
                            className={`w-full px-4 py-2.5 text-left text-[14px] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                              awardMonth === m ? 'bg-[#3180F7] text-white font-bold' : 'text-gray-700 hover:bg-blue-50'
                            }`}
                          >
                            {m}월
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* 수상명 입력 + 추가 버튼 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={awardInput}
                  onChange={(e) => setAwardInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAward()}
                  placeholder="수상명을 입력해주세요"
                  className="flex-1 h-11 bg-white border border-gray-200 rounded-xl px-4 outline-none text-[16px] text-gray-900 placeholder:text-gray-400 focus:border-[#3180F7] transition-colors"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={addAward}
                  animate={{
                    backgroundColor: awardInput.trim() ? '#3180F7' : '#E5E7EB',
                    color: awardInput.trim() ? '#FFFFFF' : '#9CA3AF',
                  }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 h-11 px-5 rounded-xl text-[14px] font-bold"
                >
                  추가
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* [선택]기업이력 - opens company search modal */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]기업이력</p>
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedCategories.map((logo) => (
                  <div
                    key={logo}
                    className="relative w-[72px] h-[48px] rounded-lg border border-[#3180F7]/30 bg-white p-1.5 flex items-center justify-center"
                  >
                    <img src={logo} alt="" className="w-full h-full object-contain" />
                    <button onClick={() => toggleCategory(logo)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                      <X size={8} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <motion.button
              onClick={() => setShowCompanySheet(true)}
              className="w-full border border-gray-200 rounded-lg px-3 py-3 bg-[#F9F9F9] text-left flex items-center justify-between"
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-sm text-gray-400">기업이력 검색 및 선택</span>
              <Plus size={16} className="text-gray-400" />
            </motion.button>
          </motion.div>

          {/* [선택]언어 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]언어</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <label key={lang} className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    onClick={() => toggleLanguage(lang)}
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${
                      selectedLanguages.includes(lang)
                        ? 'bg-[#3180F7] border-[#3180F7]'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {selectedLanguages.includes(lang) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{lang}</span>
                </label>
              ))}
            </div>
          </motion.div>

          {/* [선택]태그 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-1">[선택]태그</p>
            <p className="text-[12px] text-gray-400 mb-3">프로필 카드에 강조되는 태그입니다. 최대 6개.</p>
            <div className="flex flex-wrap gap-2">
              {['즉시출근', '풀타임 가능', '출장 가능', '심야 가능', '주말 전문', '영어 진행', '당일예약', '긴급예약', '프리미엄', '신규'].map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : (prev.length < 6 ? [...prev, tag] : prev))}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all active:scale-95 ${
                      active
                        ? 'bg-[#3180F7] text-white'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* [선택]상세설명 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">[선택]상세설명</p>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#3180F7] to-[#8B5CF6] text-white text-[11px] font-bold shadow-sm active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                title="사진·키워드로 상세페이지 자동 생성"
              >
                {aiLoading ? '생성 중...' : '✨ AI 자동 생성'}
              </button>
            </div>

            {/* Toolbar */}
            <div className="bg-[#F9F9F9] rounded-2xl px-4 py-3 mb-4 flex items-center gap-1 flex-wrap">
              {/* Bold */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('bold'); }}
                className="w-8 h-8 flex items-center justify-center font-bold text-gray-800 text-sm rounded hover:bg-gray-200"
              >B</button>
              {/* Italic */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('italic'); }}
                className="w-8 h-8 flex items-center justify-center italic text-gray-800 text-sm rounded hover:bg-gray-200"
              >I</button>
              {/* Underline */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('underline'); }}
                className="w-8 h-8 flex items-center justify-center underline text-gray-800 text-sm rounded hover:bg-gray-200"
              >U</button>

              <div className="w-px h-5 bg-gray-300 mx-1" />

              {/* Align Left */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyLeft'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="0" y="6" width="10" height="2" rx="1"/>
                  <rect x="0" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              {/* Align Center */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyCenter'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="3" y="6" width="10" height="2" rx="1"/>
                  <rect x="1.5" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              {/* Align Right */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyRight'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="6" y="6" width="10" height="2" rx="1"/>
                  <rect x="3" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              {/* Justify */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyFull'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="0" y="6" width="16" height="2" rx="1"/>
                  <rect x="0" y="12" width="16" height="2" rx="1"/>
                </svg>
              </button>

              {/* Bullet List */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <circle cx="1.5" cy="1.5" r="1.5"/>
                  <rect x="5" y="0.5" width="11" height="2" rx="1"/>
                  <circle cx="1.5" cy="7" r="1.5"/>
                  <rect x="5" y="6" width="11" height="2" rx="1"/>
                  <circle cx="1.5" cy="12.5" r="1.5"/>
                  <rect x="5" y="11.5" width="11" height="2" rx="1"/>
                </svg>
              </button>
              {/* Ordered List */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('insertOrderedList'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <text x="0" y="4" fontSize="4.5" fontFamily="sans-serif">1.</text>
                  <rect x="6" y="0.5" width="10" height="2" rx="1"/>
                  <text x="0" y="9" fontSize="4.5" fontFamily="sans-serif">2.</text>
                  <rect x="6" y="6" width="10" height="2" rx="1"/>
                  <text x="0" y="14" fontSize="4.5" fontFamily="sans-serif">3.</text>
                  <rect x="6" y="11.5" width="10" height="2" rx="1"/>
                </svg>
              </button>

              <div className="w-px h-5 bg-gray-300 mx-1" />

              {/* Color Picker */}
              <button
                onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 13.5V11l7-7 2.5 2.5-7 7H2z" fill="currentColor"/>
                  <path d="M10.5 3.5L12 2l2 2-1.5 1.5L10.5 3.5z" fill="currentColor"/>
                  <circle cx="13.5" cy="13.5" r="2" fill="#3180F7"/>
                </svg>
              </button>
              <input
                ref={colorInputRef}
                type="color"
                className="hidden"
                onChange={(e) => execFormat('foreColor', e.target.value)}
              />

              {/* Image Insert */}
              <button
                onMouseDown={(e) => { e.preventDefault(); handleImageInsert(); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <ImageIcon size={16} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageSelected}
              />

              {/* Font Size */}
              <button
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <span className="text-xs font-bold leading-none">T<span className="text-[10px]">t</span></span>
              </button>
            </div>

            {/* Editable Content */}
            <div className="relative min-h-32">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-32 outline-none text-gray-900 text-[16px] [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2"
                onInput={(e) => setDescription(e.currentTarget.innerHTML)}
              />
              {!description && (
                <span className="absolute top-0 left-0 text-gray-300 text-sm pointer-events-none select-none">
                  상세페이지
                </span>
              )}
            </div>
          </motion.div>

          {/* [선택]전문가소개영상 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]전문가소개영상</p>

            {/* 링크 추가 입력 */}
            {showVideoInput ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
                  <input
                    type="text"
                    value={videoInput}
                    onChange={(e) => { setVideoInput(e.target.value); setVideoError(''); }}
                    placeholder="유튜브 링크를 입력해주세요"
                    className="flex-1 outline-none text-[16px] text-gray-900 placeholder:text-gray-400"
                    autoFocus
                  />
                  <motion.button onClick={addVideo} whileTap={{ scale: 0.92 }} className="text-[#3180F7] text-[14px] font-bold shrink-0">추가</motion.button>
                  <motion.button onClick={() => { setShowVideoInput(false); setVideoInput(''); setVideoError(''); }} whileTap={{ scale: 0.92 }} className="text-gray-400">
                    <X size={16} />
                  </motion.button>
                </div>
                {/* Error */}
                <AnimatePresence>
                  {videoError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[12px] text-[#3180F7] font-medium mt-1.5 ml-1">{videoError}</motion.p>
                  )}
                </AnimatePresence>
                {/* Live preview */}
                {videoInput && extractYouTubeId(videoInput) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 rounded-xl overflow-hidden">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <img
                        src={`https://img.youtube.com/vi/${extractYouTubeId(videoInput)}/mqdefault.jpg`}
                        alt="preview"
                        className="absolute inset-0 w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-[#3180F7] flex items-center justify-center shadow-lg">
                          <div className="w-0 h-0 border-l-[14px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="flex gap-2 mb-3">
                <motion.button
                  onClick={() => setShowVideoInput(true)}
                  className="flex-1 flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 bg-[#F9F9F9]"
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-[14px] text-gray-400">링크 직접 입력</span>
                  <Plus size={16} className="text-gray-400" />
                </motion.button>
                <motion.button
                  onClick={() => setShowYoutubeSearch(true)}
                  className="flex items-center gap-1.5 border border-blue-200 rounded-xl px-3 py-2.5 bg-blue-50/50"
                  whileTap={{ scale: 0.98 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="4" fill="#3180F7"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="white"/></svg>
                  <span className="text-[13px] text-[#3180F7] font-semibold">검색</span>
                </motion.button>
              </div>
            )}

            {/* 비디오 목록 — with preview thumbnails */}
            {videos.length > 0 && (
              <div className="space-y-3">
                {videos.map((url, index) => {
                  const ytId = extractYouTubeId(url);
                  return (
                  <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-gray-100 overflow-hidden">
                    {/* Thumbnail preview */}
                    {ytId && (
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt="thumb"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{index + 1}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[12px] text-gray-500 truncate flex-1">{url.length > 35 ? url.slice(0, 35) + '...' : url}</span>
                      <motion.button
                        onClick={() => removeVideo(index)}
                        whileTap={{ scale: 0.9 }}
                        className="text-[12px] text-[#3180F7] font-bold shrink-0 ml-2"
                      >
                        삭제
                      </motion.button>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* [필수]전문가 FAQ */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[필수]전문가 FAQ</p>

            {/* 탭 목록 */}
            <LayoutGroup>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                {FAQ_CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat}
                    onClick={() => setActiveFaqTab(cat)}
                    className={`relative shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                      activeFaqTab === cat
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                    whileTap={{ scale: 0.92 }}
                  >
                    {activeFaqTab === cat && (
                      <motion.div
                        layoutId="faqActiveTab"
                        className="absolute inset-0 bg-gray-900 rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{cat}</span>
                  </motion.button>
                ))}
              </div>
            </LayoutGroup>

            {/* 활성 FAQ 내용 편집 */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{activeFaqTab}</p>
              <textarea
                value={faqContents[activeFaqTab] || ''}
                onChange={(e) => updateFaqContent(activeFaqTab, e.target.value)}
                placeholder="내용을 작성해주세요"
                className="w-full outline-none text-gray-900 placeholder:text-gray-400 text-[16px] resize-none bg-gray-50 rounded-xl p-4 leading-relaxed"
                rows={5}
              />
            </div>
          </motion.div>

          {/* Bottom spacer so content isn't hidden behind the fixed footer */}
          <div className="h-4" />
        </motion.div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={() => isFormValid && setShowConfirm(true)}
          disabled={!isFormValid}
          className="w-full py-4 rounded-2xl font-bold text-base"
          animate={{
            backgroundColor: isFormValid ? '#3180F7' : '#F3F4F6',
            color: isFormValid ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.3 }}
          whileTap={isFormValid ? { scale: 0.97 } : {}}
        >
          제출
        </motion.button>
      </div>

      {/* 기업이력 검색 — 전체 페이지 덮기 */}
      <AnimatePresence>
        {showCompanySheet && (
          <motion.div
            className="fixed inset-0 z-50 bg-white flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <motion.button onClick={() => setShowCompanySheet(false)} whileTap={{ scale: 0.9 }}>
                  <ChevronLeft size={24} className="text-gray-900" />
                </motion.button>
                <h2 className="text-[18px] font-bold text-gray-900">기업이력 선택</h2>
              </div>
              <p className="text-[13px] text-gray-400 mt-1">진행한 기업의 로고를 선택해주세요</p>
              {selectedCategories.length > 0 && (
                <p className="text-[13px] text-[#3180F7] font-bold mt-2">{selectedCategories.length}개 선택됨</p>
              )}
            </div>

            {/* Logo Grid */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredCompanies.map((logo, i) => {
                  const selected = selectedCategories.includes(logo);
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => toggleCategory(logo)}
                      className={`relative aspect-[3/2] rounded-xl border-2 flex items-center justify-center p-3 transition-all ${
                        selected ? 'border-[#3180F7] bg-blue-50/50 shadow-sm' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <img src={logo} alt="" className="w-full h-full object-contain" />
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#3180F7] flex items-center justify-center"
                        >
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Bottom button */}
            <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
              <motion.button
                onClick={() => setShowCompanySheet(false)}
                whileTap={{ scale: 0.96 }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px]"
              >
                선택 완료 ({selectedCategories.length}개)
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YouTube 채널 검색 페이지 */}
      <AnimatePresence>
        {showYoutubeSearch && (
          <motion.div
            className="fixed inset-0 z-50 bg-white flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <motion.button onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }} whileTap={{ scale: 0.9 }}>
                  <ChevronLeft size={24} className="text-gray-900" />
                </motion.button>
                <h2 className="text-[18px] font-bold text-gray-900">YouTube 영상 검색</h2>
              </div>
              {/* Search input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={ytChannelQuery}
                    onChange={(e) => setYtChannelQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                    placeholder="채널명을 검색하세요"
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-4 outline-none text-[16px] text-gray-900 placeholder:text-gray-400 focus:border-[#3180F7] transition-colors"
                    autoFocus
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={searchYtChannels}
                  className="h-11 px-4 bg-[#3180F7] text-white rounded-xl text-[14px] font-bold shrink-0"
                >
                  검색
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {ytLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Channel results */}
              {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
                <div className="p-4">
                  <p className="text-[12px] text-gray-400 font-bold uppercase mb-3">채널 선택</p>
                  <div className="space-y-2">
                    {ytChannels.map((ch) => (
                      <motion.button
                        key={ch.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => loadYtVideos(ch.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                      >
                        <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-gray-900 truncate">{ch.title}</p>
                          <p className="text-[12px] text-gray-400 truncate">{ch.description}</p>
                        </div>
                        <ChevronDown size={16} className="text-gray-400 -rotate-90 shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video results */}
              {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] text-gray-400 font-bold uppercase">영상 선택</p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }}
                      className="text-[12px] text-[#3180F7] font-semibold"
                    >
                      채널 다시 선택
                    </motion.button>
                  </div>
                  <div className="space-y-3">
                    {ytVideos.map((v) => {
                      const alreadyAdded = videos.includes(`https://www.youtube.com/watch?v=${v.id}`);
                      return (
                        <motion.button
                          key={v.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { if (!alreadyAdded) selectYtVideo(v.id); }}
                          className={`w-full rounded-xl overflow-hidden border text-left transition-all ${alreadyAdded ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'}`}
                        >
                          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <img src={v.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            {alreadyAdded && (
                              <>
                                <div className="absolute inset-0 bg-[#3180F7]/10" />
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                  className="absolute top-2 right-2 w-7 h-7 bg-[#3180F7] rounded-full flex items-center justify-center shadow-md"
                                >
                                  <Check size={16} className="text-white stroke-[3]" />
                                </motion.div>
                              </>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[14px] font-semibold text-gray-900 line-clamp-2">{v.title}</p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!ytLoading && ytChannels.length === 0 && !ytSelectedChannel && ytChannelQuery && (
                <p className="text-center text-gray-400 text-[14px] py-12">검색 결과가 없습니다</p>
              )}
              {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
                <div className="flex flex-col items-center py-16">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="4" fill="#DBEAFE"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#3180F7"/></svg>
                  <p className="text-[14px] text-gray-500 mt-4">채널명을 검색해주세요</p>
                  <p className="text-[12px] text-gray-400 mt-1">검색 후 영상을 선택할 수 있습니다</p>
                </div>
              )}
            </div>

            {/* Bottom: 선택 완료 */}
            {videos.length > 0 && (
              <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
                <motion.button
                  onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px]"
                >
                  완료 ({videos.length}개 영상)
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 제출 확인 바텀시트 */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowConfirm(false)}>
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative bg-white rounded-t-3xl w-full p-6 pb-10"
              variants={bottomSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">정말로 제출하시겠습니까?</h2>
              <p className="text-sm text-[#3180F7] mb-1 font-medium">
                허위로 작성된 프로필일 경우 영구제재가 이루어질 수 있습니다.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                심사기간은 최대 7일이며, 결과는 알림으로 안내드립니다.
              </p>
              <motion.button
                disabled={submitting}
                onClick={async () => {
                  if (submitting) return;
                  setSubmitting(true);
                  // localStorage 캐시 (UI 표시용)
                  localStorage.setItem('proRegistrationComplete', 'pending');
                  localStorage.setItem('proRegister_intro', intro);
                  localStorage.setItem('proRegister_careerYears', careerYears);
                  localStorage.setItem('proRegister_awards', JSON.stringify(awardList));
                  localStorage.setItem('proRegister_companyLogos', JSON.stringify(selectedCategories));
                  localStorage.setItem('proRegister_languages', JSON.stringify(selectedLanguages));
                  localStorage.setItem('proRegister_videos', JSON.stringify(videos));
                  localStorage.setItem('proRegister_faq', JSON.stringify(
                    Object.entries(faqContents).map(([key, val]) => ({ q: key, a: val }))
                  ));
                  localStorage.setItem('proRegister_description', description);

                  // 서버에 실제 proProfile 생성/업데이트 (status=pending)
                  let submitSucceeded = false;
                  let submitError: any = null;
                  try {
                    const photos: string[] = JSON.parse(localStorage.getItem('proRegister_photos') || '[]');
                    const mainPhotoIndex = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0') || 0;
                    const enabledPlans: string[] = JSON.parse(localStorage.getItem('proRegister_enabledPlans') || '[]');
                    const prices: Record<string, number> = JSON.parse(localStorage.getItem('proRegister_prices') || '{}');
                    // 어드민 설정 템플릿을 우선으로 사용
                    const { apiClient } = await import('@/lib/api/client');
                    let planMetaMap: Record<string, { label: string; desc: string; defaultPrice: number }> = {};
                    try {
                      const res = await apiClient.get('/api/v1/plan-templates');
                      const tpls = Array.isArray(res.data) ? res.data : [];
                      for (const t of tpls) {
                        planMetaMap[t.planKey] = { label: t.label, desc: t.description || '', defaultPrice: t.defaultPrice };
                      }
                    } catch {}
                    // 하드코딩 폴백 (API 실패 시)
                    const FALLBACK_META: Record<string, { label: string; desc: string; defaultPrice: number }> = {
                      premium: { label: 'Premium', desc: '행사 1시간 진행', defaultPrice: 450000 },
                      superior: { label: 'Superior', desc: '행사 2시간 진행', defaultPrice: 800000 },
                      enterprise: { label: 'Enterprise', desc: '6시간 풀타임', defaultPrice: 1700000 },
                      test: { label: 'Test', desc: '테스트용 (결제 플로우 확인)', defaultPrice: 100 },
                    };
                    const services = enabledPlans
                      .map((id) => {
                        const meta = planMetaMap[id] || FALLBACK_META[id];
                        return {
                          title: meta?.label || id,
                          description: meta?.desc,
                          basePrice: prices[id] ? Number(prices[id]) : meta?.defaultPrice,
                        };
                      })
                      .filter((s) => s.title);
                    const faqs = Object.entries(faqContents)
                      .filter(([q, a]) => q && a)
                      .map(([question, answer]) => ({ question, answer }));

                    let registeredRegions: string[] | undefined = undefined;
                    try {
                      const stored = JSON.parse(localStorage.getItem('proRegister_selectedRegions') || '[]');
                      if (Array.isArray(stored) && stored.length > 0) registeredRegions = stored;
                    } catch {}
                    const submitResponse: any = await prosApi.submitRegistration({
                      name: localStorage.getItem('proRegister_name') || undefined,
                      phone: localStorage.getItem('proRegister_phone') || undefined,
                      gender: localStorage.getItem('proRegister_gender') || undefined,
                      shortIntro: intro || undefined,
                      // profile/page 에는 '주요 경력' 텍스트 필드가 없음 → awardList 를 mainExperience 로 사용
                      mainExperience: awardList.length > 0 ? awardList.map((a) => a.text).filter(Boolean).join(' / ') : undefined,
                      careerYears: careerYears ? parseInt(careerYears) || undefined : undefined,
                      awards: awardList.length > 0 ? awardList.map((a) => a.text).filter(Boolean).join('\n') : undefined,
                      youtubeUrl: videos[0] || undefined,
                      detailHtml: description || undefined,
                      photos: photos.length > 0 ? photos : undefined,
                      mainPhotoIndex,
                      services: services.length > 0 ? services : undefined,
                      faqs: faqs.length > 0 ? faqs : undefined,
                      languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
                      category: localStorage.getItem('proRegister_category') || undefined,
                      regions: registeredRegions,
                      tags: selectedTags.length > 0 ? selectedTags : undefined,
                    });
                    submitSucceeded = true;
                    // 백엔드 응답에 user가 포함됨 → auth store 즉시 갱신 + discovery 캐시 무효화
                    try {
                      const { useAuthStore } = await import('@/lib/store/auth.store');
                      const newImg = submitResponse?.user?.profileImageUrl;
                      const cur = useAuthStore.getState().user;
                      if (newImg && cur) {
                        useAuthStore.getState().setUser({ ...cur, profileImageUrl: newImg });
                      }
                      // 홈/전문가 리스트에 최신 프로필 이미지 반영
                      const { invalidateProCache } = await import('@/lib/api/discovery.api');
                      invalidateProCache();
                      try { localStorage.removeItem('freetiful-pros-cache'); } catch {}
                    } catch {}
                  } catch (e: any) {
                    submitError = e;
                    console.error('submitRegistration failed', e);
                  }
                  setSubmitting(false);
                  setShowConfirm(false);
                  if (submitSucceeded) {
                    setShowSuccess(true);
                  } else {
                    const msg = submitError?.response?.data?.message || submitError?.message || '서버 저장 중 오류가 발생했습니다.';
                    toast.error(`신청 실패: ${msg}`, { duration: 4000 });
                  }
                }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base mb-3 flex items-center justify-center gap-2 disabled:opacity-70"
                whileTap={submitting ? {} : { scale: 0.97 }}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    제출 중...
                  </>
                ) : (
                  '제출'
                )}
              </motion.button>
              <motion.button
                onClick={() => setShowConfirm(false)}
                className="w-full py-4 text-gray-500 font-medium text-base"
                whileTap={{ scale: 0.97 }}
              >
                취소
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 제출 완료 페이지 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
              className="mb-6"
            >
              <CheckCircle size={72} className="text-[#3180F7]" />
            </motion.div>
            <motion.h2
              className="text-2xl font-bold text-gray-900 mb-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              제출이 완료되었습니다!
            </motion.h2>
            <motion.p
              className="text-base text-gray-500 text-center mb-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              7일 이내에 승인 결과를 알려드립니다
            </motion.p>
            <motion.button
              onClick={() => { router.push('/main'); }}
              className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              whileTap={{ scale: 0.97 }}
            >
              확인
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
