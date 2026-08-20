/**
 * 데이터가 없을 때 띄우는 컬러 아이콘.
 *
 * mono 세트와 달리 원본 색을 그대로 둔다 — 빈 화면에서 유일한 색 요소라
 * currentColor 로 바꾸면 단조로워진다. 회색 원 배경이나 테두리는 두르지 말고
 * 아이콘만 놓는다(디자인 요청).
 */
type ColorIconProps = { size?: number; className?: string };


export const EmptyChatIcon = ({ size = 48, className }: ColorIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M11.9999 1.5C6.1999 1.5 1.3999 5.8 1.3999 11.1C1.3999 13.4 2.3999 16.5 4.9999 18.5L4.6999 21.8C4.6999 22 4.7999 22.3 4.9999 22.4C5.0999 22.5 5.1999 22.5 5.3999 22.5C5.4999 22.5 5.5999 22.5 5.6999 22.4L9.0999 20.6C9.4999 20.6 10.7999 20.8 11.8999 20.8C17.6999 20.8 22.4999 16.5 22.4999 11.2C22.4999 5.9 17.7999 1.5 11.9999 1.5Z" fill="#3180F3"/>
  </svg>
);


export const EmptyDocumentIcon = ({ size = 48, className }: ColorIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M3.5 3V21C3.5 21.2652 3.60536 21.5196 3.79289 21.7071C3.98043 21.8946 4.23478 22 4.5 22H14.5L20.5 16V3C20.5 2.73478 20.3946 2.48043 20.2071 2.29289C20.0196 2.10536 19.7652 2 19.5 2H4.5C4.23478 2 3.98043 2.10536 3.79289 2.29289C3.60536 2.48043 3.5 2.73478 3.5 3Z" fill="#E2E5E8"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M15.5 16H20.5L14.5 22V17C14.5 16.7348 14.6054 16.4804 14.7929 16.2929C14.9804 16.1054 15.2348 16 15.5 16Z" fill="#ADB5BE"/>
  </svg>
);


export const EmptyAlarmIcon = ({ size = 48, className }: ColorIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M15.5328 19.1169C15.5328 20.0538 15.1606 20.9523 14.4981 21.6148C13.8357 22.2773 12.9372 22.6494 12.0003 22.6494C11.0634 22.6494 10.1649 22.2773 9.50242 21.6148C8.83995 20.9523 8.46777 20.0538 8.46777 19.1169H15.5328Z" fill="#FFAF31"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M3.23485 10.1159C3.23494 8.91568 3.48149 7.72821 3.95923 6.62712C4.43697 5.52602 5.13571 4.53475 6.01218 3.71472C6.88865 2.89469 7.92417 2.26336 9.05458 1.85986C10.185 1.45636 11.3862 1.28927 12.5838 1.36895C17.2428 1.67095 20.7658 5.74895 20.7658 10.4159V14.8589L22.2558 17.4419C22.3538 17.6116 22.4053 17.804 22.4054 17.9998C22.4054 18.1957 22.3539 18.3881 22.256 18.5577C22.1581 18.7274 22.0173 18.8683 21.8477 18.9663C21.6781 19.0642 21.4857 19.1159 21.2898 19.1159H2.70985C1.84985 19.1159 1.31385 18.1859 1.74385 17.4419L3.23385 14.8589L3.23485 10.1159Z" fill="#FFCD58"/>
  </svg>
);


export const EmptySearchIcon = ({ size = 48, className }: ColorIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <g clipPath="url(#fc3_clip0_55663_3831)">
    <path d="M15.6099 15.6101L20.9999 21.0001" stroke="#58697A" strokeWidth="2.4" strokeMiterlimit="10" strokeLinecap="round"/>
    <path d="M10.39 17.78C14.4714 17.78 17.78 14.4714 17.78 10.39C17.78 6.30862 14.4714 3 10.39 3C6.30862 3 3 6.30862 3 10.39C3 14.4714 6.30862 17.78 10.39 17.78Z" stroke="#AAB4BE" strokeWidth="2.4" strokeMiterlimit="10"/>
    </g>
    <defs>
    <clipPath id="fc3_clip0_55663_3831">
    <rect width="24" height="24" fill="white"/>
    </clipPath>
    </defs>
  </svg>
);
