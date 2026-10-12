package com.securetrack.fieldoperations;

/** Pure validation shared by location delivery and its safety tests. */
final class FreshLocation {
    static boolean valid(double latitude,double longitude,float accuracy,long ageMillis){
        return Double.isFinite(latitude)&&Double.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180
            &&Float.isFinite(accuracy)&&accuracy>=0&&ageMillis>=0&&ageMillis<=30000;
    }
}
