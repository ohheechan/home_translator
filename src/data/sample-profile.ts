import type { UserProfile } from "../types/profile";

/**
 * 와이어프레임 목업(Profile1/2/3, ScoreDetail)에 채워둔 placeholder 값을 그대로
 * 옮긴 예시 프로필. 실제 사용자 데이터가 아니라 스키마가 실사용 시나리오를
 * 감당하는지 확인하기 위한 픽스처 — Step 4(평가 엔진) 테스트에서 재사용한다.
 */
export const sampleProfile: UserProfile = {
  base: {
    householdMonthlyIncomeWon: 6_120_000, // 화면 표시 "612만원"
    householdSize: 3,
    dualIncome: true,
    totalAssetWon: 0, // 와이어프레임엔 placeholder만 있고 값이 없어 임시로 0 — 실제 배포 전 채워야 함
    vehicleValueWon: 0,
    accountType: "청약저축",
    joinedOn: "2016-03-01",
    installments: 48,
    residenceDistrict: "노원구",
    housingOwnership: "무주택세대구성원",
    accessibleHousingTarget: false,
    maritalStatus: "예비신혼",
  },
  detail: {
    birthDate: "1993-11-02",
    seoulLastMoveInDate: "2016-03-01",
    homelessPeriodBasis: {
      marriedBeforeAge30: true,
      marriageRegisteredOn: "2021-05-14",
      previouslyOwnedHome: false,
    },
    dependentsCount: 1,
    minorChildrenCount: 0,
    newbornChildAdjustment: {
      childrenBornAfter20230328: 1,
      hasMinorChildBornOnOrBefore20230327: false,
    },
    specialCategories: [],
    priorLongTermLeaseHistory: { hasHistory: false },
  },
};
