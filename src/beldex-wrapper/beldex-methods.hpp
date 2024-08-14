#ifndef MYBELDEX_METHODS_HPP_INCLUDED
#define MYBELDEX_METHODS_HPP_INCLUDED

#include <string>
#include <vector>

struct BeldexMethod {
  const char *name;
  int argc;
  std::string (*method)(const std::vector<const std::string> &args);
};
extern const BeldexMethod BeldexMethods[];
extern const unsigned BeldexMethodCount;

#endif
